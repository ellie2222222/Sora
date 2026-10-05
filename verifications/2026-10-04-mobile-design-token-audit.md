# Design-token conformance and enforcement in mobile/src (border widths first, plus nested radius)

**Date:** 2026-10-04T16:20:10Z
**Method:** ad hoc
**Verdict:** FAIL
**Scope:** All 289 non-test `.ts`/`.tsx` under `mobile/src` (design-system values reported separately), checked against MB-06/MB-11 and `docs/DESIGN_GUIDELINES.md` Part 3 "Design tokens", Radius, Borders, plus Part 4. The main focus is border widths. Also checked: colours, spacing, type, radius, icons, opacity, shadows, NativeWind classes, Pressable function `style`, the nested-radius rule, and what enforces any of it mechanically. This pass re-checks the state left by the token refactor earlier today.
**Files touched:** this report only
**Related reports:** [2026-10-04-theme-token-refactor.md](2026-10-04-theme-token-refactor.md) (this pass follows up on it and carries its open follow-ups forward)

## Method

Run from the repo root (Git Bash):

```bash
# 1. Border-width style props that are not a token, hairline or 0
cd mobile/src && grep -rnE "border(Top|Bottom|Left|Right|Start|End)?Width\s*:" --include=*.ts --include=*.tsx . \
  | grep -v design-system/ | grep -vE "borderWidth\.(thin|medium|thick)|hairlineWidth"
grep -rnE "border(Top|Bottom|Left|Right|Start|End)?Width\s*:" --include=*.ts --include=*.tsx . | grep -v design-system/ | wc -l
grep -rnoE "borderWidth\.(thin|medium|thick)" --include=*.ts --include=*.tsx . | awk -F: '{print $NF}' | sort | uniq -c
grep -rnE "\bborder(Top|Bottom|Left|Right)?Width\s*[,}]|const border(Top|Bottom|Left|Right)?Width\s*=" --include=*.tsx . | grep -v design-system/
grep -rn "hairlineWidth" --include=*.ts --include=*.tsx .

# 2. Every NativeWind class in use (looks for border*/divide*/ring*, arbitrary values, numeric scale)
grep -rhoE 'className="[^"]*"' --include=*.tsx . | sed -E 's/className="//; s/"$//' | tr ' ' '\n' | grep -v '^$' | sort | uniq -c | sort -rn

# 3. Line scanner for every other category (scratchpad token-scan.mjs). It covers:
#    style keys = number, ternary numeric fallbacks, JSX size/strokeWidth/width/height/radius/hitSlop={n},
#    hex/rgb/hsl/named colours, NativeWind arbitrary/numeric/bare-border classes, inline shadow*,
#    and a function `style` on <Pressable|TouchableOpacity|AnimatedPressable>.
#    Non-zero literals only; test files are excluded.
node <scratchpad>/token-scan.mjs mobile/src

# 4. Leftovers: token arithmetic with a literal, module-level numeric consts, numeric default params,
#    icon size/stroke expressions, literal fontWeight, StyleSheet.create bodies
grep -rnE "(theme|sizes|spacing|radius|iconSize|fontSize)\.[A-Za-z.]+\s*[-+]\s*[1-9][0-9.]*\b" --include=*.ts --include=*.tsx .
grep -rnE "^(export )?const [A-Z_a-z]+\s*=\s*-?[0-9.]+\s*;" --include=*.ts --include=*.tsx . | grep -v design-system/
grep -rnoE "strokeWidth=\{[^}]*\}" --include=*.tsx . | awk -F'strokeWidth=' '{print $2}' | sort | uniq -c
grep -rnoE "\bsize=\{[^}]*\}" --include=*.tsx . | awk -F'size=' '{print $2}' | sort | uniq -c | sort -rn
grep -rnE "fontWeight:\s*'" --include=*.tsx . | grep -v design-system
grep -rnE "borderColor" components/MoneyInput.tsx features/categories/components/CategoryPicker.tsx components/Input.tsx components/DateField.tsx features/accounts/components/AccountPicker.tsx

# 5. Nested radius: list every bordered element and every clipping container, then read each parent/child pair
grep -rnE "overflow: ?'hidden'|overflow-hidden" --include=*.tsx .
grep -rn "<SwipeableRow" --include=*.tsx .

# 6. Enforcement
ls -a . mobile | grep -iE "eslint|prettier|biome|stylelint"
node -e "for (const p of ['package.json','mobile/package.json']) { const j=require('./'+p); console.log(p, j.scripts) }"
grep -n '"lint"' server/package.json packages/contracts/package.json
grep -nE "run:" .github/workflows/ci.yml
node --test mobile/src/design-system/colors.test.ts mobile/src/design-system/contrast.test.ts
```

## Findings

### A. Border widths (primary focus)

- **Style props.** There are 51 `border*Width:` assignments outside `design-system/`:
  - 49 use `theme.borderWidth.*` or `StyleSheet.hairlineWidth`;
  - 1 is `borderBottomWidth: 0` (BottomSheetModal.tsx:198), which is allowed;
  - the Button shorthand `borderWidth` (Button.tsx:122) is `0 : theme.borderWidth.thin`, which is allowed.
  - **0 literal violations. PASS.**
- **Token use.** `thin` 49, `medium` 3 (Input:81, MoneyInput:155, the AddContributionModal:181 checkbox), `thick` 2 (Toast's left accent at ToastProvider:115 and the tab indicator height at MainTabNavigator:142).
- **`StyleSheet.hairlineWidth`.** 3 uses, all allowed: SettingsScreen:67, SettingsScreen:92, CollapsibleSection:12.
- **NativeWind.** There are no `border*`, `divide-*`, `ring-*` or `outline-*` classes anywhere. 35 distinct classes are in use and all are token-named or layout classes. **PASS.**
- **Border width used as a line thickness.** `height: theme.borderWidth.thin` at LoginScreen:140/144 and `theme.borderWidth.thick` for the tab indicator at MainTabNavigator:142. Both fit the meaning given in `sizes.ts` ("indicator bar"). **PASS.**
- **The guideline does not match the token scale. FAIL (docs).**
  - DESIGN_GUIDELINES:311 says a hairline is "0.5–1px".
  - Lines 312 and 355 say "2px borders" mark selection, focus or a featured card.
  - `borderWidth` only has `thin` 1, `medium` 1.5 and `thick` 3. There is no 2.
  - So the prose describes a value that no token produces, and focus actually uses 1.5.
- **Single-sided accent with rounded corners. FAIL.**
  - At ToastProvider:115–116, the toast pairs `borderLeftWidth: thick` with `borderRadius: radius.md`.
  - DESIGN_GUIDELINES:306 says a left-border-only accent gets radius 0.
- **Control border colour. FAIL.**
  - MoneyInput:156 and CategoryPicker:51 draw the field boundary with `colors.border`.
  - Input:82, DateField:49 and AccountPicker:108 use `colors.borderControl`.
  - The only pair that checks a control boundary for 3:1 (colors.test.ts:218–222) is `borderControl`. So these two fields render a boundary that no test checks.

### B. Other token categories

| Category | Non-DS hits | Verdict |
|---|---|---|
| Colour literals (hex/rgb/hsl/named) | 0 (all 98 hits are inside `design-system/colors.ts` and `shadows.ts`) | PASS |
| Numeric style values (non-zero) | 1: `opacity: 1 - slideProgress.value` (ThemeToggle:69), an animation value and allowed | PASS |
| Ternary numeric fallbacks | 11, all the allowed `cond ? theme.opacity.* : 1` | PASS |
| JSX `size`/`strokeWidth`/`width`/`height`/`radius`/`hitSlop={n}` | 0 literal. Icon sizes are all `theme.iconSize.*`, props or proportions (`size * 0.5`, `size * 0.44`). Strokes are `theme.iconStroke.*` or a prop | PASS |
| Inline shadows | 0 outside `design-system/shadows.ts` | PASS |
| Pressable function `style` (rule 15) | 0 | PASS |
| NativeWind arbitrary values | 1: `w-[22%]` (DatePickerModal:210). Percentages are allowed, but the guideline also bans arbitrary-value classes | LOW |
| Literal `fontWeight` | DatePickerModal:134 `'bold'` beside Mulish (Android falls back to the system font, already noted in the prior report). RootNavigator:80–83 repeats the `theme.fontFamily` strings as literals for the React Navigation theme | LOW |
| Module-level numeric consts | 41. All are counts/limits, timeouts, or animation/gesture values (`SKIRT`, `OPEN_THRESHOLD`, `pullMath` offsets). The exception is `TAB_BAR_HEIGHT = 56` at tabBarMetrics.ts:5, a dead duplicate of `sizes.tabBar.height` that is re-exported from app/navigation/index.ts:5 and imported by nothing | LOW (carried over) |
| Token arithmetic with a literal | 1: `lineHeight.md + 2 * spacing.md` (AiChatScreen:293), a proportion and allowed | PASS |
| `StyleSheet.create` bodies | 3 files, holding only layout, `zIndex`, `'92%'` and `spacing.sm` imported directly (ToastProvider:147, carried over) | PASS |

### C. Nested radius: inner = outer − border width (− padding when padded)

**Rule status.**
- DESIGN_GUIDELINES:304 states only `inner = outer − outer padding`. It never mentions border width.
- No test or lint rule checks either form.

**Method.** For each bordered or clipping container whose child has its own radius and sits flush against it (or across padding), I compared the inner radius with `outer − border − padding`. The 17 pairs checked are below.

| # | File:line (outer → inner) | Outer | Border | Padding | Inner | Expected | Verdict |
|---|---|---|---|---|---|---|---|
| 1 | features/planning/screens/PlanningScreen.tsx:233 → :244, :265 (segmented control) | `radius.md` 10 | `thin` 1 | `xxs` 2 | `radius.sm` 6 | 9 border-only / 7 strict | FAIL −1 (7 is not on the radius scale; `sm` 6 is the nearest token) |
| 2 | features/transactions/components/TransactionListScreen.tsx:342 → :354 (type tabs) | md 10 | thin 1 | xxs 2 | sm 6 | 7 | FAIL −1, same shape as #1 |
| 3 | features/transactions/components/TransactionListSkeleton.tsx:55 → :64 (tab skeleton) | md 10 | thin 1 | xxs 2 | sm 6 | 7 | FAIL −1, same shape as #1 |
| 4 | components/ThemeToggle.tsx:106–108 → :120 (track → thumb), sizes sm/md/lg | h/2 = 13/15/18 | thin 1 | `(h − thumb)/2` = 3 | thumb/2 = 10/12/15 | 9/11/14 | FAIL +1. The padding at :39 ignores the border, so the thumb overflows the content box by 2px. `travelDistance` (:44) has the same error, so the thumb sits 4px from the left edge, 2px from the right and 3px from top and bottom: asymmetric |
| 5 | features/chat/components/ChatInputBar.tsx:56–57 → :104–105 (field → send button) | `radius.xl` 20 | thin 1 | margin `(48 − 36)/2` = 6 | pill 18 | 13 | FAIL +5. A `pill` outer on the 50px single-line field would give exactly 25 − 1 − 6 = 18, but the field grows to 6 lines |
| 6 | features/chat/components/ActionProposalCard.tsx:40–42 → Button.tsx:147 (button row in the bottom-left corner) | lg 14 | thin 1 | md 12 | md 10 | 1 | FAIL strict form. This is systemic: `Card` (lg 14, padding md 12) gives 2 for any rounded child in a corner, and no radius token is that small |
| 7 | components/TransactionListSection.tsx:41 → :48 (day card → clip view) | lg 14 | 0 | 0 | lg 14 | 14 | PASS |
| 8–9 | PlanningScreen.tsx:147, :208 `SwipeableRow radius=lg` → `Card` lg (Card.tsx:19) | lg | 0 | 0 | lg | lg | PASS |
| 10–11 | features/wallets/components/WalletMembersPanel.tsx:140, :159 → `Card` lg | lg | 0 | 0 | lg | lg | PASS |
| 12 | features/wallets/components/WalletDetailPanel.tsx:165 → `Card` lg | lg | 0 | 0 | lg | lg | PASS |
| 13 | features/wallets/components/WalletSwitcher.tsx:121 → WalletRow :270 | md | 0 | 0 | md | md | PASS |
| 14 | components/ProgressBar.tsx:35 → :43 (track → fill, same height) | pill | 0 | 0 | pill | pill | PASS |
| 15 | features/settings/screens/SettingsScreen.tsx:88–93 (Card lg, hairline, `overflow: hidden`) → CollapsibleSection header fill (no radius) | lg | hairline | 0 | clipped | outer − border, applied by the platform clip | PASS |
| 16 | features/settings/components/AppearanceSection.tsx:16–20 (swatch, `rounded-sm overflow-hidden`) → square stripes | sm | thin | 0 | clipped | platform clip | PASS |
| 17 | features/chat/components/ConversationHistorySheet.tsx:45 `SwipeableRow radius=md` → square Pressable | md | 0 | 0 | clipped | platform clip | PASS |

**Totals.** 17 pairs: 11 PASS, 6 FAIL. Of the 6 FAILs, 3 are the same −1 segmented-control shape, 1 is a +1 that causes a visible asymmetry, 1 is +5, and 1 is the systemic padded-card case.

**Bordered elements with no rounded child against the border (N/A):**
- form fields: Input, MoneyInput, DateField, AccountPicker, CategoryPicker (its dot is not in a corner);
- pills: PeriodBar, AccountScopePicker, MonthSelector, StateView retry, SuggestedPromptChips;
- cells and keys: AddBudgetModal goal row, the AddContributionModal checkbox, CalculatorKeypad keys (square), DatePickerModal and DateStrip day cells (outer and inner are never both visible);
- other: PullToRefreshIndicator (the child has no radius or fill), BottomSheetModal, Toast, ActionSheet rows.

### D. Mechanical enforcement

| Mechanism | Exists | What it enforces |
|---|---|---|
| ESLint / Biome / Stylelint config | **No.** There is no config file in the repo root or `mobile/`, and no lint dependency in either `package.json` | nothing |
| Root `npm run lint` | It runs `--workspaces --if-present`, but no workspace defines `lint`, so it **runs nothing** | nothing |
| TypeScript (`tsc --noEmit`, CI ci.yml:159) | yes | Only that tokens exist and are spelled right. RN style types accept any `number`, so `borderWidth: 2` typechecks |
| `mobile/src/design-system/colors.test.ts` + `contrast.test.ts` (CI ci.yml:162). Run this pass: **78/78 pass** | yes | Token *values*: contrast of every `RENDERED_PAIRS` pair in every palette and mode, status/flow hex identity, disabled tokens, text hierarchy. It does **not** check which token a component uses (see A, the control border colour) |
| `tailwind.config.js` ↔ `spacing/radius/typography.ts` parity | **No.** It is kept in sync "by hand" (tailwind.config.js:9–11). The config `extend`s the default theme, so Tailwind's numeric scale (`p-4`, `border-2`, `opacity-80`) still resolves, and border width is not mirrored at all | nothing |
| `scripts/check-contract-parity.mjs` | yes | contracts/schema/API only, nothing about UI |
| Nested-radius rule | no | nothing |

**Conclusion.**
- MB-06 and the Part 4 token item are **prose-only**.
- Today's conformance (0 literal border widths, 0 colour literals) comes from the one-off scanner run in the refactor, not from a gate. A regression would pass CI.

## Fixes Applied

None (read-only pass).

## Follow-ups

**Medium (visible or correctness):**
1. ThemeToggle.tsx:39 and :44. Subtract `theme.borderWidth.thin` from `padding`, and use the corrected padding in `travelDistance`. The thumb is currently 4px from the left edge and 2px from the right, overflowing its content box by 2px. Once fixed, the strict rule holds (e.g. md: 15 − 1 − 2 = 12).
2. MoneyInput.tsx:156 and CategoryPicker.tsx:51. Use `colors.borderControl` for the resting field boundary, as Input, DateField and AccountPicker do. That is the only control boundary that has a 3:1 check.
3. ChatInputBar.tsx:56. The outer `radius.xl` (20) is not concentric with the send button (pill 18, inset 7). Either use `pill` while single-line, or give the button `xl − border − margin` = 13.

**Low:**
4. Segmented controls at PlanningScreen.tsx:233/244/265, TransactionListScreen.tsx:342/354 and TransactionListSkeleton.tsx:55/64 are 1px off (the strict form gives 7). Either accept `sm` 6 as the snapped value and say so in the guideline, or derive the radius as `radius.md − borderWidth.thin − spacing.xxs`.
5. ToastProvider.tsx:115–116. The left accent is rounded, which breaks DESIGN_GUIDELINES:306. Either drop the radius or switch to an inner accent bar.
6. DESIGN_GUIDELINES:304, 311–312 and 355:
   - extend the nested-radius rule to `inner = outer − border − padding`;
   - state how to treat padded Cards (lg 14 − md 12 = 2, which is below every radius token);
   - align "0.5–1px" and "2px" with the actual `borderWidth` scale (1 / 1.5 / 3).
7. DatePickerModal.tsx:210 `w-[22%]`. Use `style={{ width: '22%' }}` so that NativeWind holds no arbitrary-value class.
8. RootNavigator.tsx:80–83. Read `fontFamily.*` from the design system instead of repeating the strings.

**Carried over from 2026-10-04-theme-token-refactor.md (still open):**
- `app/navigation/tabBarMetrics.ts` (`TAB_BAR_HEIGHT = 56`) is unused apart from its barrel re-export. Deleting it needs approval.
- ToastProvider.tsx:147 imports `spacing` directly into a module-level StyleSheet.
- DatePickerModal.tsx:134 has `fontWeight: 'bold'` beside Mulish.
- The day cards, the Planning FAB and the snapped sizes have not been checked visually, and no E2E flow taps `btn-add-budget` or `btn-add-goal`.
- Eleven unused locals predate this work.

**Recommended mechanical enforcement (none exists today):**
- **Add a `mobile/src/design-system/tokens-usage.test.ts`** that runs under the existing `npm test -w @sora/mobile` glob, so CI step ci.yml:162 picks it up with no CI change. It would read every non-test `.ts`/`.tsx` outside `design-system/` and fail on:
  - `border*Width:` followed by a non-zero number;
  - hex, rgb or hsl colour literals;
  - `(padding|margin|gap|fontSize|lineHeight|letterSpacing|borderRadius|opacity|top|left|right|bottom|width|height|min*|max*):` followed by a non-zero number outside an allowlist (files listed for animation and gesture);
  - JSX `size|strokeWidth|radius|hitSlop={<number>}`;
  - NativeWind `-[`, numeric-scale or `border(-\w)?` classes;
  - a function `style` on `Pressable`.
  - The scratchpad `token-scan.mjs` used here is a working starting point. Allowed exceptions go in a reviewed allowlist (file:pattern), not inline.
- **Add a `tailwind-parity` assertion in the same test.** It would `require('../../tailwind.config.js')` and compare `spacing`, `borderRadius` and `fontSize` with the TS tokens. It would also set `theme.borderWidth`, `opacity` and the numeric `spacing` scale **outside** `extend`, so that Tailwind's defaults stop resolving.
- **Optional:** add ESLint with `no-restricted-syntax` selectors (e.g. `Property[key.name=/^border.*Width$/] > Literal[value!=0]`) plus a `lint` script in `mobile/package.json`, so the root `npm run lint` actually runs something, and add it to ci.yml. This is a bigger change, a new dependency that needs your approval, which is why the test above is the first recommendation.
- **Nested radius cannot be grepped reliably.** Add a token-level assertion instead: give segmented-control and toggle radii one helper (`concentricRadius(outer, border, padding)`) and unit-test it, so call sites derive the radius and never pick it.
