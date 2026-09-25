# Pre-ownership queued changes: bound to the first post-upgrade launch's session, otherwise orphaned

**Date:** 2026-09-25T02:33:07Z (first pass 02:26:31Z; the failed-write edge case fixed after review)
**Method:** ad hoc
**Verdict:** PASS (unit tests, typecheck, bundle). Not driven on a device with a real pre-upgrade install.
**Scope:** the user's decision on the open question from `2026-09-25-comment-audit.md`.
- Queue rows written before rows carried an owner hold no reliable ownership information.
- Previously, `setOwner` gave them to whoever signed in next, so on a shared device one person's changes could sync into another person's account.
- Now only the session persisted when the app first starts after the upgrade can claim them, including when that launch's database write fails.

**Files touched:**
- `mobile/src/services/sync/{offlineQueue,offlineQueue.test,offlineQueueDb,testSupport}.ts`
- `mobile/src/services/storage/preferencesStore.ts`
- `mobile/src/app/providers/AuthProvider.tsx`
- `SDS.md` §4.4
- `verifications/2026-09-25-comment-audit.md` (follow-up closed)

**Related reports:** `2026-09-25-comment-audit.md`, `2026-09-24-follow-ups-pass.md` (where ownership was introduced)

## Design as built

- **No claim on sign-in:** `OfflineQueue.setOwner` only scopes what is visible and synced.
- **Which account:** `OfflineQueue.resolvePreOwnershipRows(restoredUserId, decisions)` runs at every launch.
  - `AuthProvider` passes the account from the session that `session.restore()` read back from secure storage. That is the persisted session, before validation and before any login made in this launch.
  - The account comes from the token's `sub` claim, so it works even when the app starts offline or the token has since been revoked.
- **The decision is durable and decided once:**
  1. It reads the recorded decision from app preferences (`PRE_OWNERSHIP_OWNER_STORAGE_KEY = 'finance.sync.preOwnershipOwner.v1'`, AsyncStorage), which is kept outside the sync database.
  2. If nothing is recorded (the first launch after the upgrade), it records `restoredUserId ?? ORPHANED_OWNER`.
  3. Only then does it assign the ownerless rows to the recorded owner.

  Every later launch uses the recorded owner and ignores that launch's session. So a failed SQLite write, even a database that can't open at all, is retried for the same owner and never for whoever is signed in by then.
- **Fail closed:** if the decision can't be read or recorded, the rows are orphaned.
- **Orphaned rows** have owner `ORPHANED_OWNER = 'orphaned:pre-ownership'`. No account id has that shape, so they are:
  - never listed and never synced (both read only the current owner's rows);
  - absent from `pendingCount`;
  - excluded from `ownersWithOpenRows`, so they don't trigger the other-account warning;
  - never claimed later, because only ownerless rows are assigned.
- **Logging:** `console.warn` with the orphaned count, or a fixed message when assignment failed. Payloads and ids are never logged (LA-01).
- **Idempotent:** enqueue refuses to write a row without an owner, so once assignment succeeds later launches change nothing.
- **Nothing is deleted.** Orphaned rows stay on the device ("no hard removal of financial data").
- **Remaining limit:**
  - If both the preferences write and the SQLite write fail on the first launch, nothing is recorded, and the next launch decides afresh.
  - That needs two independent stores to fail together; there is no third store to fall back on.

## Findings

`offlineQueue.test.ts`, "OfflineQueue pre-ownership rows": 8 tests, all PASS.
1. A sign-in alone never receives the rows: `current()` and `ownersWithOpenRows()` are both empty.
2. The restored account receives both rows (`{ owner: 'user-a', count: 2 }`), and the decision is recorded as `user-a`. A later user sees none.
3. With no restored session the rows are orphaned. A later sign-in sees nothing, the pending count is 0, and a second resolution changes 0 rows.
4. **The review's scenario:**
   - Launch 1 has A's session saved, and the assignment fails (`SQLITE_BUSY`, which rejects). The decision `user-a` is still recorded.
   - Launch 2 has B's session saved and B signed in. The row goes to `user-a`: B's `current()` is empty, the pending count is 0, and `ownersWithOpenRows()` is `['user-a']`.
   - When A signs in, A sees the row.
5. An orphaning decision (no session on launch 1) whose assignment fails is still orphaned on launch 2, when B's session exists.
6. A decision that can't be recorded leaves the rows orphaned, even with A's session.
7. A decision that can't be read leaves the rows orphaned.
8. A sync database that can't open on launch 1 still records `user-a`, and launch 2 with B's session assigns to `user-a`.

Checks:
- `npx tsc --noEmit` in `mobile/`: exit 0.
- `npm run test` in `mobile/`: 417/417.
- `npx expo export --platform android`: bundled (3768 modules).

## Fixes Applied

- **First pass:**
  - `DB.claimUnowned(owner): void` → `assignUnowned(owner): number`, in SQLite (from `runAsync().changes`), the web memory store and the test store.
  - `setOwner` no longer claims.
  - `resolvePreOwnershipRows` and `ORPHANED_OWNER` added; `ownersWithOpenRows` excludes the marker.
- **Review fix:**
  - The `PreOwnershipDecisions` store was added: recorded before the queue is touched, reused on every later launch, and failing closed to orphaning.
  - `AuthProvider` backs it with `preferencesStore` and logs the failed-assignment case.
  - A `countUnowned` pre-check written in between was removed: it touched the database before the decision was recorded, which reopened the same edge case.
- SDS §4.4 "Ownership" updated.

## Follow-ups

- **Device check:** install a pre-upgrade build and queue a change offline, then upgrade.
  - Launch with A's session saved: the change belongs to A and syncs.
  - Repeat with no saved session, then sign in as B: the change never appears, never syncs, and isn't counted as pending.
- **Recovery:** orphaned rows have no in-app way to recover or export them. That is a separate product decision, not requested.
