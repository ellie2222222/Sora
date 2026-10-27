# Mobile app audited screen by screen against DESIGN_GUIDELINES.md, mechanical findings fixed

**Date:** 2026-10-23T05:19:57Z
**Method:** ad hoc (5 parallel read-only audits, then fixes per area)
**Verdict:** PASS (static checks and tests); not checked on a device
**Scope:** every non-test file in `mobile/src/components/`, `mobile/src/features/*`, `mobile/src/app/navigation/`, `mobile/src/app/providers/`, `App.tsx`. Checked against `docs/DESIGN_GUIDELINES.md` Parts 1–4 and CLAUDE.md MB-01..MB-11, NC-04 and Part 7 rules 15 and 19
**Files touched:** ~70 files under `mobile/src/` (see `git diff`); all 10 `mobile/src/app/i18n/locales/*.ts`; `docs/DESIGN_GUIDELINES.md`; new `mobile/src/utils/fieldErrors.ts` (+test)
**Related reports:** 2026-10-16-text-contrast-and-tab-states.md, 2026-10-19-theme-color-transition.md

## Method

1. Five read-only audits, one per area: shared components; home/transactions/planning/budgets/goals; dashboard/accounts; wallets/settings/categories; auth/guest/chat/navigation/providers. Each finding was tagged MECHANICAL (follows directly from a rule) or DECISION (product judgement).
2. Each area's MECHANICAL findings were fixed by an agent restricted to that area's files. Locale files were not edited by any agent. New and changed keys came back as JSON and were applied to all 10 catalogs by one script.
3. Checks:
   - `npm run typecheck` (all packages)
   - `npm run test -w @sora/mobile`
   - `node --test src/app/i18n/localeParity.test.ts src/app/i18n/plurals.test.ts`
   - a scan of every literal `t('a.b')` key in `mobile/src` against `en.ts`
   - `git status` review for files changed outside scope

## Findings

| Area | Found | Fixed | Skipped |
|---|---|---|---|
| Shared components | 53 | 40 | 13 DECISION |
| Home / transactions / planning / budgets / goals | 26 + 4 notes | 17 | rest DECISION |
| Dashboard / accounts | 32 | 20 | 2 testID renames, 10 DECISION |
| Wallets / settings / categories | 52 | 38 (incl. 1, 4: confirm before archive/permanent delete) | 2 testID renames, rest DECISION |
| Auth / guest / chat / shell | ~45 | all MECHANICAL | login testID renames, DECISION |

The fixes fall into these groups:

- **Reduce Motion:** `AnimatedScreen`, `BottomSheetModal`, `Skeleton`, `PeriodSummaryCard` now respect it. The decorative float/pulse is removed from `StateView`.
- **Touch targets (44pt):** hitSlop or minHeight derived from tokens, on chips, segments, date cells, links, header icons and toasts.
- **Accessibility:** missing role, label, selected state and `tablist`/`tab`.
- **Text that clips at large font sizes:** `Button`, `Input`, `MoneyInput`, `DateField`, `AccountPicker` use `minHeight`, not `height`.
- **Disabled styling:** `ActionSheet`, `PeriodBar`, `SuggestedPromptChips` and `CategoryManageDialog` no longer show disabled by opacity alone. A loading `Button` keeps its resting colours.
- **States at the smallest scope:**
  - false empty states on failure (wallet accounts, wallet list, conversation history, invitations) now show an error with retry;
  - spinners replaced by shaped skeletons;
  - guest create errors are inline.
- **Aggregate labels:**
  - budget and goal figures on the Dashboard;
  - goal "Left";
  - "Transferred in/out" instead of "In/Out";
  - the yearly chart has a legend, its currency and an accessibility summary.
  - A period with only transfers is no longer hidden.
- **Business rules:**
  - the goal-budget picker lists only ACTIVE goals;
  - "Add contribution" only shows for ACTIVE goals (the API answers 409 otherwise).
- **Translation:**
  - new `validation.*` keys with `zodFormResolver` (`utils/fieldErrors.ts`) for the login and register screens;
  - activity events, entity types and results are translated;
  - hardcoded strings ('Dark'/'Light', role labels, default budget name, raw ISO date, raw enum) replaced;
  - sentence case applied;
  - "e.g." placeholders and filler words removed.
- **Form errors:** they now show under the field (description, note, invitation email, category name, wallet name).
- **Hardcoded values:** About reads its version from `app.json`, and the made-up "Build 1" row is removed. The Appearance preview amount goes through `<Money>`.

Evidence:

- `npm run typecheck`: no errors in any package.
- `npm run test -w @sora/mobile`: 816 tests, 816 pass, 0 fail.
- `localeParity.test.ts` + `plurals.test.ts`: 13 pass, 0 fail.
- Key scan: "all literal t() keys exist in en.ts". Template-literal keys such as `activity.events.${code}` are not covered by the scan; their keys were added for every code the agent enumerated.
- `git status`: outside `mobile/src`, this pass changed only `docs/DESIGN_GUIDELINES.md`. Everything else listed was already uncommitted before the pass.

## Fixes Applied

- **`docs/DESIGN_GUIDELINES.md`:**
  - Cards: the net worth section now sits on the screen, not in a card (user-requested change);
  - Row actions: budgets **Delete** (BR-04), not Archive.
- **Locales:** about 1,100 key operations across the 10 catalogs. Removed keys nothing reads: `goals.loadFailed`, `dashboard.transferredIn/Out` (keys only, not the dashboard data fields), `dashboard.noData`, `dashboard.spendingChangedPeriod`, `dashboard.increased/decreased`, `categories.noneYet`, `settings.build`.

Re-verification is the evidence above, run after all fixes and locale changes were applied.

## Follow-ups

DECISION items left for the product owner:

- **Donut:** callouts on every slice conflict with "Donut ≤ ~6 slices, rest grouped as Other". Either record the exception or group the tail as Other.
- **`Money`:** transfers render in neutral text, not `colors.transfer`.
- **Form validation:** forms other than login and register still show raw English Zod messages (budgets, goals, transactions, accounts). Adopt `zodFormResolver`/`fieldErrors` there. Custom refinements need `params.i18nKey`.
- **Buttons as selection:** primary-filled Buttons act as selection in the transaction type, budget period, account type and invitation role/relation pickers. `SegmentedControl` would fit better.
- **Shadows and borders:**
  - `PeriodSummaryCard` is an elevated in-flow card;
  - `BottomSheetModal` has both a border and a shadow;
  - `IconChip` is tinted warning when neutral.
- **Unreachable screen:** `AcceptInvitation` has no deep link or app-stack route.
- **Card-per-row lists:** members, invitations, activity rows and the guest wallet list.
- **Settings menu:** it sits in a bordered card with dividers.
- **Category swipe:** "Delete" opens a chooser where delete is often disabled.
- **Sheet headers:**
  - `ConfirmDialog` builds its own title row;
  - `DatePickerModal`'s year step uses a hand-built Back.
- **Font scaling:** `AccountCard` and the tab bar use fixed heights around text.
- **Guest upload motion:** the spring and burst run past 400ms.
- **Toast position:** the toast and the guest upload pill overlap.
- **Wallet day:** `ConversationHistorySheet` groups by the device's day, not the wallet's (rule 18).
- **testID renames to NC-04:** the login screens, `dashboard-segment-*`, `picker-currency`, `wallet-detail-*`, `settings-*`. They need matching e2e flow edits.
- **Not checked on a device:** Reduce Motion behaviour, the touch targets and the year `FlatList`.
