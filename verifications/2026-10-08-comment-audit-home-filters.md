# Comment audit of the Home filters, account sheets, transaction list and money fixes

**Date:** 2026-10-08T08:41:25Z
**Method:** ad hoc (comment-audit skill)
**Verdict:** PASS
**Scope:** the comments added or changed in the files covered by `2026-10-08-home-filters-account-sheet.md`, plus every comment in that pass's new files:

- `AccountDetailModal`
- `AccountEditForm`
- `AccountScopePicker`
- `accountScope.ts`
- `CategoryFilterChip`

The guest upload files are excluded; `2026-10-08-comment-audit-guest-upload.md` covers them.

**Files touched:**

- `mobile/src/features/transactions/components/TransactionListScreen.tsx`
- `mobile/src/app/navigation/MainTabNavigator.tsx`

**Related reports:**

- `2026-10-08-home-filters-account-sheet.md`
- `2026-10-08-comment-audit-guest-upload.md`

## Method

- **Policy:** CLAUDE.md Part 7 rule 11: why not what, 1–2 lines, no debug journal, `TODO` only with a reference.
- **Comments added in tracked files:** `git diff -U0` over the in-scope paths, keeping only added lines that start with `//`, `/*`, `*` or `{/*`.
- **New files:** `grep -nE "^\s*(//|/\*|\*|\{/\*)"`.
- **Each candidate** was read in context. Each cross-reference was grepped to confirm its target exists.

## Findings

- `TransactionListScreen.tsx:61`: `ListRow` doc said "the sticky type filter". The sticky row now also holds the account chips and the category chip. Stale (pattern 4); rewritten to "the sticky filters".
- `TransactionListScreen.tsx`, `accountFilter` prop doc: said the chips sit "beside the type filter". They render above it. Stale (pattern 4); rewritten to "above".
- `MainTabNavigator.tsx`: "Only its width is fluid: it stretches in flight and springs back to size on arrival" narrates the `stretch` animation values beneath it (pattern 8). Removed. The neighbouring sentence stays, because it explains choosing deceleration over a spring.
- **Comments checked and kept as genuine why:**
  - `HomeScreen.tsx`:
    - tying the scope to its wallet;
    - applying each params object once.
  - `MainTabNavigator.tsx`:
    - the static resting position;
    - before-paint ordering.
  - `TransactionListScreen.tsx`:
    - `currentData` vs `data`;
    - the filter as a row, not a header;
    - per-row offset;
    - the testID clash with the add sheet;
    - the per-pane key.
  - `AccountDetailModal.tsx`:
    - the account's own wallet decides permissions;
    - press-out never arrives;
    - scroll for the keyboard.
  - `AccountEditForm.tsx`:
    - `key` requirement;
    - the archive hint.
  - `money.ts` and `money.test.ts`: the Hermes `exceptZero` quirk.
  - `Money.tsx`: a zero is neutral.
  - `calc.ts`: `largestCurrencyTotal` shared with the server.
  - `AccountScopePicker.tsx`: the archived-filter visibility; ellipsize instead of overflow.
  - `accountScope.ts`: the thresholds.
  - `SlideSwap.tsx`: `useSwapOffset`.
  - `WalletSwitcher.tsx`: one sheet at a time.
  - `types.ts`: Home params and the root-stack doc.
  - `pull-to-refresh.yaml`: swipe geometry.
- **Not found:** commented-out code, untracked `TODO`/`FIXME`, or comments that only restate code.
- **Not added:** no missing-comment gaps cleared the "a reader would be surprised" bar.

## Fixes Applied

- The three comment edits above.
- **Comment-only check:** the diff lines for the edits are comment text only.
- **Re-run:**
  - `npm run typecheck -w @sora/mobile`: clean.
  - `npm run test -w @sora/mobile`: 685/685 pass.

## Follow-ups

These are flagged, not fixed. Each is a fragile cross-reference that still resolves today.

- `AccountDetailModal.tsx:135`: "laid out like the transaction sheet's detail rows". This points at `DetailRow` in `TransactionDetail`, and nothing keeps the two layouts in sync.
- `MainTabNavigator.tsx`: "the same horizontal-motion treatment as `SlideSwap`". This relies on `SlideSwap` keeping its `Easing.out(Easing.cubic)` deceleration.
- `AccountEditForm.tsx:18`: "(§9.4)" means `docs/API_SPECIFICATION.md` §9.4 `PATCH /accounts/{id}`, which exists, but the comment doesn't name the document.
