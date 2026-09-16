# Double-check: Pressable function-style bug fix and preceding session changes

**Date:** 2026-09-16T00:00:00Z
**Method:** double-check skill
**Verdict:** PASS
**Scope:** Changes made in this session not yet covered by any existing report — the NativeWind-interop
function-`style` bug on `Pressable` (root cause + fix across 6 files, now `CLAUDE.md` rule 15), the
`income`/`expense`/`success`/`danger` color softening, the `budgets.detailTitle`/`goals.detailTitle`/
`activity.title`/`accounts.detailTitle` i18n additions and `AppNavigator.tsx` title wiring, the
`DateStrip`/`TransactionListScreen` slide animations, the `TransactionListSection` recently-created-only
row animation, and the `WalletSwitcher` loading-skeleton dimension fix. The broader NativeWind migration
itself was already verified in `verifications/2026-09-15-nativewind-migration.md` and is not re-checked
here.
**Files touched:** `mobile/src/components/{Button,MonthSelector,DatePickerModal,ThemeToggle}.tsx`,
`mobile/src/features/settings/components/{LanguageSection,CollapsibleSection,AppearanceSection}.tsx`,
`mobile/src/app/providers/ThemeProvider.tsx`, `mobile/src/design-system/colors.ts`,
`mobile/src/app/i18n/locales/{en,vi}.ts`, `mobile/src/app/navigation/AppNavigator.tsx`,
`mobile/src/components/{DateStrip,TransactionListSection,TransactionTotals}.tsx`,
`mobile/src/features/transactions/components/TransactionListScreen.tsx`,
`mobile/src/features/wallets/components/WalletSwitcher.tsx`, `CLAUDE.md`,
`plans/mobile/transaction-ui-plan.md`
**Related reports:** `verifications/2026-09-15-nativewind-migration.md` (the migration these fixes sit on
top of); this report supersedes nothing, it covers new ground.

## Method

- `git status`/`git diff --stat` to confirm the actual changed-file set for this session against the
  working tree.
- Repo-wide grep for the bug class itself: `style=\{\(` (parenthesized-arg function style) and
  `style=\{[a-zA-Z_]\w*\s*=>` (single-unparenthesized-arg function style) across `mobile/src/` — both
  zero matches, confirming no remaining function-`style` Pressable anywhere in the tree.
- `npm run typecheck -w @sora/mobile` (full `tsc --noEmit`).
- `npm test -w @sora/mobile` (`node --test`, 139 tests).
- `node scripts/check-contract-parity.mjs` (31 checks — enum/route/error-code agreement between the
  migration, contracts, and the API specification).

## Findings

1. **Root-cause fix is complete and exhaustive.** The bug (`react-native-css-interop` spreads any
   function passed as `style` into `{}`, discarding it, on *every* interop'd component regardless of
   `className`) was fixed in all 6 files that had it: `Button.tsx`, `MonthSelector.tsx`,
   `DatePickerModal.tsx`, `LanguageSection.tsx`, `CollapsibleSection.tsx`, `AppearanceSection.tsx`. A
   repeat repo-wide grep (both the parenthesized and unparenthesized arrow-function forms) turns up
   nothing outstanding — confirmed clean, not just "not re-found by the same narrow pattern used the
   first time."
2. **`Button.tsx`'s `onPressIn`/`onPressOut` chaining is correct.** `pressableProps` (containing any
   caller-supplied `onPressIn`/`onPressOut` before destructuring) is spread first in JSX, and the
   explicit `onPressIn`/`onPressOut` props — which call the destructured caller callback before setting
   local `pressed` state — are listed after, so they win the JSX prop-precedence order and still invoke
   the caller's original handler. No double-invocation, no dropped caller handler.
3. **Per-row pressed-state tracking (`LanguageSection`, `AppearanceSection`) is correctly scoped.**
   Each uses one `useState<string | null>` keyed by the row's own identifier (locale code / theme name)
   rather than one hook per row in the `.map()` — checked against React's rules of hooks (no
   conditional/loop-scoped hook calls) and confirmed correct.
4. **`CLAUDE.md` rule 15 documents the mechanism with file:line references into
   `node_modules/react-native-css-interop`, not just a restated symptom** — a future session hitting the
   same "button lost its style" report can verify the claim against the library's actual source rather
   than trusting the write-up alone.
5. Typecheck, test suite, and contract-parity all pass clean (details below) — no regression from any of
   this session's other changes (color softening, i18n additions, animation wiring).

No dead code, duplicated logic, or drifted docs found in the touched files beyond what's already listed
above as fixed.

## Fixes Applied

None needed this pass — the findings above are confirmations, not new defects.

## Follow-ups

- `mobile/app.json:16` still has a trailing comma (noted in an earlier session's investigation) —
  harmless (Expo's config loader uses `json5`, which tolerates it) but worth a cleanup pass since strict
  `JSON.parse` elsewhere would choke on it.
- The custom money-entry calculator keyboard (requested separately) is a new feature, not yet built —
  tracked as the next task, not a finding against existing code.
