# Double-check: wallet-header connection/sync status indicators

**Date:** 2026-09-15T11:14:33+07:00
**Method:** double-check skill, scoped to the feature just built in this conversation
**Verdict:** PASS
**Scope:** `ConnectionSyncStatus.tsx` (new), `OfflineBanner.tsx` (removed), `WalletContextBar.tsx`,
`offlineQueueSlice.ts`'s new `selectSyncStatus`, `useNetworkStatus.tsx`'s simplification,
`components/index.ts`'s barrel swap, and the i18n key changes across all 10 locale files this pass
touched (adds to en/vi, dead-key removals everywhere). Also verified consistency against three files
changed by a concurrent, non-self-authored process during the same session
(`StateView.tsx`, `TransactionListScreen.tsx`, `offlineQueueDb.ts`) without redesigning them.
**Files touched:** none this pass — verification only.
**Related reports:** [2026-09-15-double-check-commit-reorganization.md](2026-09-15-double-check-commit-reorganization.md),
[2026-09-15-double-check-offline-sync.md](2026-09-15-double-check-offline-sync.md) (the sync engine/queue
this feature's icons read status from)

## Method

Read `CLAUDE.md` fresh (unchanged since commit `a0e08b7`, per `git log -1 -- CLAUDE.md`, so the copy
already loaded this session is current). Delegated a Phase 1 sweep to a general-purpose agent, scoped
to the files this feature touched, checking: dead references to the removed `OfflineBanner`/
`hasSyncError`/`setSyncError`/`errors.offlineMessage`/`errors.syncFailed`; whether the six
`lucide-react-native` icon imports are real exports of the installed version; whether the new
component's `testID`s match this repo's actual practiced convention (not just CLAUDE.md's NC-04 table);
whether reusing `BottomSheetModal` for an informational (non-list, non-form) popover matches how the
rest of the codebase already uses it; en/vi `errors:` key parity; and whether the 8 inactive locales
picked up any addition (only removals are allowed there per rule 13). Independently re-ran the full
verification suite and a direct grep for the original disclosed phrase ("your local data is still
available" and its 8 translated forms) across `mobile/src`.

## Findings

1. **Dead code — none.** Zero remaining references to `OfflineBanner`, `hasSyncError`, `setSyncError`,
   `errors.offlineMessage`, or `errors.syncFailed` anywhere in `mobile/` (confirmed independently after
   the agent's report, via a repo-wide grep).

2. **Icon imports confirmed real**, not assumed: `lucide-react-native@1.46.0` is what's actually
   installed (mobile's `package.json` declares `^1.33.0`, satisfied); `Wifi`, `WifiOff`, `Check`,
   `Clock`, `RefreshCw`, `TriangleAlert` are all present named exports in the installed package's ESM
   bundle.

3. **`testID` convention: CLAUDE.md's own NC-04 table (`btn-[action]-[entity]`, `sheet-[entity]`, etc.)
   is not what this codebase actually does anywhere.** A repo-wide grep for those exact patterns
   returns zero hits; every real component (`WalletSwitcher.tsx`, `ConfirmDialog.tsx`,
   `AddBudgetModal.tsx`) uses `<component-name>-<element>` instead, which is exactly what
   `ConnectionSyncStatus.tsx` already does (`connection-sync-status-connection`,
   `-sync`, `-connection-sheet`, `-sync-sheet`, `-sync-now`). No fix needed on this component — but
   NC-04 itself is documentation describing a convention nothing in the codebase follows, which is its
   own drift (see Follow-ups).

4. **`BottomSheetModal` reuse for an informational popover is consistent with existing usage**, not an
   odd pattern — `ConfirmDialog.tsx` already uses the same shape (title + muted text + one conditional
   button) for non-list, non-form content. The only cosmetic difference is `ConfirmDialog`'s colored
   icon-badge header, which `ActionSheet.tsx` also skips — not a real inconsistency.

5. **i18n key parity confirmed exact**: en/vi `errors:` block, 73 keys each, identical names and order.
   All 8 inactive locales show pure 2-line removals (`offlineMessage`, `syncFailed`) and zero additions,
   honoring rule 13.

6. **The originally-reported phrase is gone everywhere.** A direct grep for "your local data is still
   available" and its German/Spanish/French/Hindi/Japanese/Korean/Russian/Chinese translations across
   `mobile/src` returns zero hits.

7. **Consistency with the concurrently-changed files** (`StateView.tsx`, `TransactionListScreen.tsx`,
   `offlineQueueDb.ts` — not authored in this pass): `StateView.tsx`'s network-error branch correctly
   points at `errors.offlineTitle`, which still exists in both active locales; the web-platform
   in-memory queue fallback added to `offlineQueueDb.ts` implements the same `QueuedMutation`/
   `QueueStatus` shape this pass's `selectSyncStatus`/`selectPendingCount` selectors already consume —
   no shape drift between the two.

8. **Full verification suite, clean:**
   ```
   npm run typecheck                       # contracts, server, mobile — all clean
   npm test -w @sora/mobile                # 136/136 pass
   node scripts/check-contract-parity.mjs  # 31/31 PASS
   ```

## Fixes Applied

None needed — everything checked came back clean.

## Follow-ups

- **CLAUDE.md's NC-04 `testID` table describes a convention nothing in this codebase actually follows**
  (`btn-[action]-[entity]`, `sheet-[entity]`, etc. — zero real usages found anywhere). Either the table
  should be updated to document the `<component-name>-<element>` pattern actually in use, or a real
  migration is owed. Not fixed here — a doc-vs-practice question for whoever owns that table, out of
  scope for this feature.
- Still open from prior reports: whether another session/IDE is concurrently editing this repo (flagged
  last turn, unconfirmed); on-device verification of the whole offline-sync/connection-status stack
  (no device/emulator in this environment).
