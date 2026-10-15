# Audit decisions remediation: offline conflicts, edit lock, archived references, durable idempotency, rule 18 anchors

**Date:** 2026-10-12T07:37:13Z
**Method:** ad hoc (second remediation pass on the owner's answers to the full audit's open items)
**Verdict:** PASS
**Scope:** the owner's decisions on `2026-10-12-full-project-audit.md`: 1 offline conflicts (best practice), 2 lock concurrent transaction edits, 3a refuse archived categories / closed goals, 3c durable idempotency, 4 remaining follow-ups (A1 rule 18 anchors, list-fit of offline creates, pagination cap, small mobile fixes). 3b is answered, not implemented.
**Files touched:** listed per fix below; new files `db/migrations/003_idempotency_keys.sql`, `db/tests/003_idempotency_keys.sql`, `server/test/integration.idempotency.test.ts`, `mobile/src/services/api/retryKeys.ts` (+ test), `mobile/src/services/sync/syncTags.ts` (+ test), `mobile/src/services/sync/listFit.ts` (+ test), `mobile/src/components/StuckWritesList.tsx`, `mobile/src/hooks/useWalletDay.ts`.
**Related reports:** follows `2026-10-12-full-project-audit.md`. `2026-10-12-gemini-intent-context.md` and the untracked `server/src/ai/*` files are separate, concurrent work, not touched here.

## Method

Database: throwaway cluster `pg_ctl -D <scratchpad>/pgcluster -o "-p 55437 -c listen_addresses=127.0.0.1"`, `DATABASE_URL=postgresql://scratch@127.0.0.1:55437/scratch_audit_6d1345`. `sora_dev` never touched.

```
npm run typecheck
node scripts/check-contract-parity.mjs
npm run agents:check
npm test -w @sora/contracts
npm test -w @sora/mobile
DATABASE_URL=… npm test -w @sora/server
DATABASE_URL=… npm run db:test
node scripts/audit-runtime-deps.mjs
```

## Findings

1. **Lost update on concurrent transaction edits (decision 2).** `server/test/integration.concurrency.test.ts` "BR-03: an edit waiting on another edit of the same transaction keeps both changes": without the row lock the amount reverted to `10.0000`; with `lockedRow` (`SELECT … FOR UPDATE`) inside the update transaction it passes. Category and goal reads take `FOR SHARE` so an archive cannot interleave. → PASS
2. **Archived category / closed goal accepted on a transaction (3a).** `CATEGORY_ARCHIVED` / `GOAL_NOT_ACTIVE` (409, VL-03) on create and on an edit that changes the reference; an edit keeping the stored one is allowed (`keepsStored`). Unit test in `transaction-category.test.ts`, integration test in `integration.transactions.test.ts`, guest mirror in `guestTransactions.test.ts`. Contributions refuse an archived expense category too. → PASS
3. **Idempotency lost on restart / across instances (3c).** Keys now in `idempotency_keys` (migration 003): replay of the stored response, 422 on a reused key with a different body, 409 `IDEMPOTENCY_KEY_IN_USE` after a 30 s wait on an in-flight claim, take-over after 2 min, claim released on failure, 24 h retention with hourly purge. `integration.idempotency.test.ts` 7 cases; `decideReplay` unit tests; `db/tests/003_idempotency_keys.sql` probes each constraint by name. Client: `retryKeys.ts` reuses a key only for an identical unanswered request. → PASS
4. **Offline conflicts stranded / unsynced writes vanishing on refetch (decision 1).** Stuck rows listed with entity, amount/name and server reason, with Try again (`retry`) and Discard (`discard` + dependents via `dependentRows`); tag invalidation deferred while an open row holds the tag (`syncTags.ts`); synced rows pruned after 24 h unless an open row still resolves through them (`prunableRows`). Offline creates are unshifted only into cached lists they fit (`listFit.ts`). → PASS
5. **A1, rule 18: list/dashboard anchors seeded from the device zone.** `TransactionListScreen` `selectedDay` and `DashboardScreen` `anchor` used `useState(() => today(timeZone))`, frozen at mount before the wallet zone arrived. Now `useWalletDay(timeZone)`: follows the wallet's today (zone change, midnight) until the user picks another day. `chosenDay` unit test in `date.test.ts`. → PASS
6. **Page number unbounded.** `MAX_PAGE = 1_000_000` in contracts; `page=1000001` and `1e20` rejected (contracts test). → PASS

Final run (all after the last edit):

| Command | Result |
|---|---|
| `npm run typecheck` | no errors |
| `check-contract-parity.mjs` | 65/65 |
| `agents:check` | 11 skills in sync |
| contracts tests | 174 pass, 0 fail |
| mobile tests | 717 pass, 0 fail |
| server tests (scratch DB) | 295 pass, 0 fail |
| `db:test` | 001, 002, 003 PASS |
| `audit-runtime-deps.mjs` | no unaccepted high/critical (2 accepted, expire 2026-11-02) |

## Fixes Applied

See Findings; each was re-verified by the command in the table above. Spec amended in the same change: `docs/API_SPECIFICATION.md` §2.8, §2.10, §11.2, §11.4, §13.7; `SDS.md` error table; `plans/mobile/offline-sync-plan.md` §8; `docs/test-plans/offline-sync.md` TC-SYNC-21..28.

## Follow-ups

- **3b, decision needed:** `POST /transactions` accepts `status: DELETED`; only guest upload relies on it. Proposed: restrict create to `PENDING`/`COMPLETED`, guest upload creates then calls `/transactions/{id}/delete`.
- TC-SYNC-28 (stuck-write list on a device) is Open: needs a device run.
- Not done this pass, carried from the full audit: test-plan `#L` line references (~133 stale), `domain-database-design.md` §14 schema copy, CLAUDE.md/AGENTS contribution hard-remove wording, spec index missing two auth endpoints, ERROR_CODES.md/SDS drift, contracts duplicates (`resolvePeriod`, `AuditResult`), picker error states, parity/db-test blind spots, dead-code files (deletion needs the owner's say).
- Scratch cluster at `<scratchpad>/pgcluster` is running on 55437; stop it with `pg_ctl -D … stop`. Not deleted.
