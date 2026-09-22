# Comment audit: repo-wide (weighted toward this session's uncommitted work)

**Date:** 2026-09-21T00:00:00Z
**Method:** comment-audit skill — Phase 1 delegated to three parallel Explore agents (rename files,
this session's newest AddTransactionModal feature files, remaining uncommitted mobile files), every
finding re-verified against the live file before any edit, per the skill's own instruction
**Verdict:** PASS — 14 comment-only fixes applied, several flagged-not-fixed items carried forward,
one over-reach caught and reverted
**Scope:** Whole repo, per the unscoped `/comment-audit` invocation — but leaning on
[2026-09-12-comment-audit.md](2026-09-12-comment-audit.md)'s already-clean full sweep of
`server/src`, `packages/contracts`, `db/`, `scripts/` (unchanged since, except the files this
session's cancelled→deleted rename touched) rather than re-reading everything from scratch. Three
scan groups: (1) the cancelled→deleted rename's server/contracts/migration files, never audited
since that rename; (2) this session's newest AddTransactionModal/CategoryGrid/CalculatorKeypad
redesign, only lightly checked during an earlier double-check pass; (3) every other currently-
uncommitted mobile file (per `git status`) not covered by a prior session-scoped comment-audit pass.
**Files touched:** [packages/contracts/test/calc.test.ts](../packages/contracts/test/calc.test.ts),
[server/src/audit/audit-events.ts](../server/src/audit/audit-events.ts),
[db/migrations/004_rename_transaction_status_cancelled_to_deleted.sql](../db/migrations/004_rename_transaction_status_cancelled_to_deleted.sql),
[mobile/src/utils/calculatorEngine.ts](../mobile/src/utils/calculatorEngine.ts),
[mobile/src/components/BottomSheetModal.tsx](../mobile/src/components/BottomSheetModal.tsx),
[mobile/src/components/Button.tsx](../mobile/src/components/Button.tsx),
[mobile/src/components/MoneyInput.tsx](../mobile/src/components/MoneyInput.tsx),
[mobile/src/services/guest/guestAccounts.ts](../mobile/src/services/guest/guestAccounts.ts),
[mobile/src/services/sync/entityAdapters.ts](../mobile/src/services/sync/entityAdapters.ts),
[mobile/src/utils/errors.ts](../mobile/src/utils/errors.ts),
[mobile/src/app/providers/ThemeProvider.tsx](../mobile/src/app/providers/ThemeProvider.tsx)
**Related reports:** [2026-09-16-comment-audit-calculator.md](2026-09-16-comment-audit-calculator.md),
[2026-09-16-comment-audit.md](2026-09-16-comment-audit.md),
[2026-09-15-comment-audit.md](2026-09-15-comment-audit.md),
[2026-09-12-comment-audit.md](2026-09-12-comment-audit.md) (carries forward the still-open
follow-ups reconfirmed below),
[2026-09-21-add-transaction-redesign-double-check.md](2026-09-21-add-transaction-redesign-double-check.md)

## Method

Read `CLAUDE.md` Part 7 rule 11 fresh. Three Explore agents ran in parallel, each scoped to a
distinct file group and told to cite `file:line`, apply rule 11's violation patterns plus the
"flag, don't auto-fix" duplicated-reference rule, and report read-only (no edits). Every candidate
finding was then re-verified against the live file by hand before any edit — reading the
surrounding function, not just the flagged line.

## Findings

### Fixed (comment-only)

1. **`calc.test.ts:203-204`** (pattern 4, stale) — `// ...not the cancelled 700,000...` still named
   a status value (`CANCELLED`) that no longer exists post-rename (the test data at line 169 uses
   `TransactionStatus.DELETED`). Rewritten to "not the deleted 700,000".
2. **`server/src/audit/audit-events.ts:41`** (gap) — `TRANSACTION_DELETED` had no note, unlike
   `CATEGORY_DELETED` just above it (which documents a real hard delete). The asymmetry is real and
   non-obvious: `transactions.service.ts`'s `delete()` only flips `status`, never removes the row
   (BR-03). Added a one-line clarifying comment.
3. **`db/migrations/004_...sql:11`** (gap) — the `UPDATE` running before the constraint swap is
   load-bearing (the new `CHECK` no longer admits `'CANCELLED'`), not just incidental ordering.
   Added a one-line comment; migration is still unapplied/uncommitted, so this isn't an edit to an
   applied migration.
4. **`calculatorEngine.ts:224`** (pattern 4, stale/wrong) — comment claimed `OPERATOR_GLYPHS` was
   `OPERATOR_ALIASES`' keys "minus the ASCII `+`/`-`/`*`/`/`", but `'+'` is actually still in the
   array (nothing to exclude for it — only `-`/`*`/`/` have a distinct unicode counterpart being
   excluded). Fixed to drop `+` from the exclusion list.
5. **`BottomSheetModal.tsx:31`** (pattern 1, restates-the-code) — `/** Standardized slide-up bottom
   sheet modal component. */` restates the name/props. Deleted.
6. **`Button.tsx:45→146`** (misplaced) — `// style can never be a function here` sat disconnected
   from the code that actually guarantees it (the `typeof style === 'function' ? style(...) :
   style` ternary at what's now line 146), reading as if it contradicted that ternary at first
   glance. Moved to sit directly above it, reworded to state what it's guaranteeing.
7. **`MoneyInput.tsx:79-80`** (pattern 1, restates-the-code) — `commitExpression`'s intro comment
   duplicated the rationale already given at the auto-commit effect above it, without adding a new
   fact. Deleted.
8. **`MoneyInput.tsx:100-102`** (pattern... debug-journal narration) — "...it flashed '8' the
   instant '5+3' became valid, before the second '0' was typed" narrated a specific past bug's
   symptom rather than stating the forward-looking rule. Rewritten to keep the rule, drop the
   symptom history.
9. **`guestAccounts.ts:5-8`** (rotting reference) — cited exact server line numbers
   (`balance.service.ts:180-218`) that will drift the moment that file is edited. Dropped the line
   range, kept the function-name cross-reference.
10. **`entityAdapters.ts:31`** (pattern 4, stale/wrong post-rename) — `/** Transactions/goals
    cancel... */` is now factually wrong for transactions (`cancelOrArchive`'s transaction branch
    calls `apis.transactions.delete(...)`, confirmed at line 74). Fixed to "Transactions delete;
    goals cancel; ...".
11. **`errors.ts:46`** (pattern 1) — `/** Check if an error represents a network/connectivity
    failure. */` restates `isNetworkError`'s name. Deleted.
12. **`errors.ts:210-213`** (pattern 1) — doc-comment on `getServerErrorMessage` restated its
    3-branch body (network → offline key, mapped code → i18n key, else generic fallback) with
    nothing not already evident from a 10-line read. Deleted.
13. **`ThemeProvider.tsx:69-89`** (pattern 6, multi-paragraph bloat) — 21-line docstring on
    `AnimatedThemeRoot` carried four genuinely non-obvious facts (native-overlay-vs-web-CSS split,
    why `beginTransition` exists, the ~90-call-site re-render cost, `pendingImperativeTrigger`'s
    dedup role) buried in repetitive prose. Condensed to ~9 lines, same four facts retained, no
    extraction needed since the file-move itself would be a structural (non-comment) change.
14. **`ThemeProvider.tsx:186-189`** (pattern 6) — 4-line `themeRef` comment bundled the real why
    (needs the previous theme's background synchronously at press time) with a redundant hedge
    ("a fresh identity each render would still work, but this avoids recreating the closures").
    Condensed to 3 lines, hedge dropped.

### Caught and reverted — not this skill's charter

- **`calc.test.ts`'s `it('excludes cancelled rows...')` description** — initially rewrote this to
  "excludes deleted rows..." alongside finding 1's genuine `//` comment fix, then caught that a test
  description string is a code line (a string-literal argument to `it()`), not a comment — the
  skill's own non-negotiable constraint is comment-only edits. **Reverted** the string back to
  `'excludes cancelled rows...'**;** finding 1's actual `//` comment fix stands on its own. Listed
  under Follow-ups below rather than fixed.

### Flagged, not fixed (verbatim-duplicated / fragile cross-references)

- **`CategoryGrid.tsx:32`** — `// Same default-to-first-category shortcut as CategoryPicker.` is a
  new, third copy of the default-to-first-item logic/comment already flagged in
  [2026-09-15-comment-audit.md](2026-09-15-comment-audit.md) as duplicated between
  `AccountPicker.tsx`/`CategoryPicker.tsx`. Now spans three files. Extraction (a shared hook) is a
  code change, out of this skill's scope.
- **`MoneyInput.tsx:41-42`** — cross-references `CalculatorKeypadProps.expressionRef`'s own
  comment. Verified it still resolves (that comment exists, matches the claim). Left as-is per the
  "if it still resolves, leave it" rule — nothing mechanically keeps the two in sync.
- **`AnimatedScreen.tsx:23` / `BottomSheetModal.tsx:19` / `Skeleton.tsx:12`** — verbatim-identical
  `// The native animated module doesn't exist on web...` comment in three files. Real DRY problem
  in the comments, not the code; a shared constant/comment site is a code change, out of scope.

## Fixes Applied

The 14 edits listed under "Fixed" above. Diffed each touched file against `HEAD` and confirmed every
hunk from this pass's own edits touches only comment lines (the surrounding large diffs in several
files are this session's earlier, unrelated logic changes — e.g. the cancelled→deleted rename, the
calculator-commit rework, the Button.tsx loading-label fix — already present before this pass and
untouched by it). Re-verified: `npm run typecheck -w @sora/contracts` clean, `npm test -w
@sora/contracts` 63/63; `npm run typecheck -w @sora/server` clean; `npx tsc --noEmit` (mobile)
clean, `npm test` (mobile) 159/159.

## Follow-ups

- **`calc.test.ts`'s `it('excludes cancelled rows...')` test description** still says "cancelled"
  post-rename — genuinely stale, but fixing it means touching a non-comment (string-literal) line,
  outside this skill's charter. A trivial, safe rename a future pass (or direct request) can apply
  in one line.
- Carried forward, still open, from [2026-09-15-comment-audit.md](2026-09-15-comment-audit.md) /
  [2026-09-16-comment-audit-calculator.md](2026-09-16-comment-audit-calculator.md):
  - `mobile/src/features/dashboard/screens/HomeScreen.tsx:12-14` — debug-journal-style "(unlike the
    old global FAB this replaced)" clause, still outside every session's declared scope so far.
  - `AccountPicker.tsx`/`CategoryPicker.tsx` (now also `CategoryGrid.tsx`, see Findings above)
    duplicated default-to-first-item comment/logic — extraction is a code change.
  - `StateView.tsx:66-70` — long fallback-justification comment; the real fix (extract the
    substring check to a named helper so the comment collapses) is a code change.
- Verified, not a bug (context for a future pass so it isn't re-flagged): `errors.ts`'s
  `ERROR_CODE_TO_I18N_KEY['TRANSACTION_ALREADY_DELETED']` still points at i18n key
  `errors.transactionAlreadyCancelled`, and `TransactionDetailModal.tsx`'s translation keys are
  still named `cancelTransaction`/`cancelConfirmTitle`/etc. — both are **deliberate**, from this
  session's own cancelled→deleted rename: key *names* were kept as-is specifically to avoid
  breaking the 8 inactive locales' `DeepPartial<TranslationResource>` typecheck (MB-09); only the
  displayed *values* changed to "deleted" wording.
