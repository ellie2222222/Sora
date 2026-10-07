# i18n audit: en/vi sync, fallback drift, orphans, and a friendlier tone pass

**Date:** 2026-10-06T06:38:18Z
**Method:** i18n-audit skill
**Verdict:** PASS (copy not seen on a device; no device attached)
**Scope:** The whole mobile catalog (`mobile/src/app/i18n/locales/`) checked against every `t(...)` call under `mobile/src`. The tone rewrite covers en + vi, with the transactions feature first, as asked. Inactive locales: dead keys removed only (CLAUDE.md rule 13).
**Files touched:**
- `mobile/src/app/i18n/locales/{en,vi}.ts`, plus `{de,es,fr,hi,ja,ko,ru,zh}.ts` (deletions only);
- `TransactionListScreen.tsx`, `AboutSection.tsx`, `AccountDetailScreen.tsx`, `AddBudgetModal.tsx`;
- inline fallbacks in about 20 more component files.
**Related reports:** 2026-10-06-i18n-budget-follow-ups.md

## Method

- Scratchpad scanner `i18nscan.mjs`:
  - flattens `en.ts`;
  - matches every literal `t('key', default | { defaultValue })` under `mobile/src`, locales excluded;
  - reports keys not in `en`, defaults that differ from `en`, catalog keys with no reader (single/double quotes, template prefix, dynamic `${`), and vi values identical to en.
- Scratchpad `align.mjs` rewrites each drifted inline default to the `en` value.
- `npm run typecheck`, then deleting exactly the lines the checker named in the inactive locales.
- `npm run test -w @sora/mobile`.
- `grep` of `mobile/e2e` and the docs for any changed UI strings.

## Findings

1. **Missing keys (8): FAIL, now fixed.** Vietnamese users saw these in English:
   - the transaction filter chips `common.all` and `` `transactions.type.${type}` `` (All/Income/Expense/Transfer);
   - `budgets.daily`, `budgets.yearly`, `budgets.goal`, `budgets.chooseGoalFirst`, `budgets.overall`;
   - `goals.noGoals`;
   - `welcomeSubtitle` (no namespace).
2. **Fallback drift (11 before the rewrite): FAIL, now fixed.**
   - `AccountDetailScreen` reused `common.archived`, `errors.accountArchived` and `errors.internalError` with different meanings in their defaults. It now has its own `accounts.archivedTitle/archivedMessage/loadFailed`.
   - `AddBudgetModal` showed the goals load error through `common.error`; it now uses `goals.loadFailed`.
   - After the tone rewrite, `align.mjs` brought 58 inline defaults back to the catalog. A re-scan finds 0 drift.
3. **Orphans (4), zero readers:**
   - `home.expenses`, `transactions.crossWalletLabel` and `accounts.accountNotFound` (the error map reads `errors.accountNotFound`, a different key);
   - `common.archived` (its only reader moved to `accounts.archivedTitle`).
   - Removed from en, vi and the 8 inactive locales (4 lines × 8, each line confirmed to hold the named key).
4. **vi values identical to en:** only `nav.ai` ("AI"), `auth.emailLabel` ("Email"), theme names and language names. All expected.
5. **Tone:** en and vi rewritten to be warmer and more conversational.
   - Labels stay plain; the warmth goes into empty states, hints, toasts and errors.
   - Delete/clear confirmations still say plainly that there's no undo.
   - Transactions examples:
     - the note placeholder is now "What was it for?" / "Khoản này để làm gì?";
     - the delete body reads "…your balances and budgets will act as if it never happened";
     - the truncation note reads "Showing the newest N of M. Keep scrolling for the full totals.";
     - the view-only notice names the role that's needed;
     - an empty period reads "All quiet in {{period}}".
   - Vietnamese consistency:
     - transfers are "Chuyển khoản" everywhere;
     - the dashboard is "Tổng quan" in both the tab and the screens;
     - roles read "Người chỉnh sửa/Người xem" (the English left in brackets is gone);
     - `budgetPeriodOverlap` no longer says "danh mục" (it also applies to goal and overall budgets);
     - "Xoá" spelling made consistent as "Xóa".
6. **E2E text selectors still match:** `offline-sync.yaml` matches "Offline.*", "Changes waiting to sync" and "Data synced". None of those three strings changed.
7. **Hardcoded text:** none found in `features/transactions` or `components` (JSX text, `placeholder`/`label`/`title`/`accessibilityLabel` literals).

## Fixes Applied

- See Findings 1–5. Re-verified:
  - the re-scan shows MISSING 0, DRIFT 0, ORPHAN 0;
  - `npm run typecheck` exit 0;
  - `npm run test -w @sora/mobile`: 641/641 pass.

## Tone-down revision

The user found the first rewrite too playful. Scratchpad `tonedown.py` replaced exact values, about 55 in en and 75 in vi:
- **Removed:**
  - interjections and cheering: "Oops", "Whoa", "Nice", "Heads up", "You've got this", "Ối", "Tuyệt", "Cố lên";
  - jokey titles: "All quiet in…", "{{period}} yên ả quá", "Say hi!";
  - in Vietnamese, the casual "nhé" endings and the assistant's first-person "mình".
- **Toasts** are plain confirmations again ("Goal created", "Đã tạo mục tiêu").
- **Kept from the first pass:**
  - the 8 missing keys;
  - Vietnamese term consistency;
  - clearer errors that say what to do next (archive instead of delete, which role is needed);
  - "Pick a…" wording.

Re-verified:
- `align.mjs` brought 16 more inline defaults back to the catalog;
- the re-scan shows MISSING 0, DRIFT 0, ORPHAN 0;
- a grep for the removed playful markers finds nothing;
- `npm run typecheck`: 0 errors;
- `npm run test -w @sora/mobile`: 641/641.

## Vietnamese month names

- **Problem:** the date formatters in `mobile/src/utils/date.ts` all requested `month: 'short'`, which ICU renders in Vietnamese as "thg 10".
- **Observed:** `toLocaleDateString('vi', …)` gives "6 thg 10, 2026" with short and "6 tháng 10, 2026" with long.
- **Fix:** `monthStyle(locale)` returns `'long'` for `vi` and `'short'` otherwise. All 8 call sites use it.
- **Tests:** the vi expectations in `date.test.ts` and `dashboardPeriod.test.ts` were updated, e.g. "24 tháng 9" and "tháng 8 năm 2026".
- **Verified:** `npm run typecheck` 0 errors; mobile tests 641/641.

## Expense / income / transfer terms

Each type now has one name everywhere it's used: filters, the type picker, category headers, summary totals, empty states, the dashboard and AI drafts.

| | en | vi |
|---|---|---|
| Expense | Expense, Expenses (was "spending" or "spent" in labels) | Chi tiêu (was "Chi", "khoản chi" or "đã chi") |
| Income | Income (was "earned" in totals) | Thu nhập (was "Thu", "khoản thu" or "đã thu") |
| Transfer | Transfer, Transfers, Transferred in/out | Chuyển khoản, Chuyển vào/ra |

Verbs inside sentences ("You spent…", the budget's "Spent") stay as they were.

Re-verified:
- `align.mjs` updated 5 more inline defaults;
- the re-scan is clean;
- typecheck 0 errors; mobile tests 641/641.

## Follow-ups

- Have a native speaker read the Vietnamese copy.
- `errors.syncDetailPending` still uses "change(s)" rather than plural keys. Changing it moves the e2e-visible sync copy, so it's left for its own pass.
- Not seen on a device this pass (no device attached).
