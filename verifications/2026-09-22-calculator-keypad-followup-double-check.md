# Double-check + comment-audit of the calculator-keypad follow-on work

**Date:** 2026-09-22T08:01:40Z
**Method:** double-check skill + comment-audit skill (combined, per explicit `/double-check /comment-audit` invocation)
**Verdict:** PASS
**Scope:** Everything since `2026-09-21-add-transaction-redesign-double-check.md` / `2026-09-21-comment-audit-repo-wide.md` — the `CalculatorKeypad` reference-screenshot redesign, `MoneyInput` consistency fix, starter-categories/icon expansion, the `AddTransactionModal` hooks-order crash fix, the 4-screen `permissions.canWrite` loading-race fix, the `accounts.accounts` i18n bug, the row-1 layout fix, the web input-blur fix, Today→DatePicker + inline-account-picker consolidation, and the button-wording fixes. Server/contracts/migration files predating that boundary were out of scope (already covered).
**Files touched this pass:** `mobile/src/utils/calculatorEngine.ts`, `mobile/src/utils/calculatorEngine.test.ts`, `mobile/src/components/CalculatorKeypad.tsx`, `mobile/src/components/MoneyInput.tsx`, `mobile/src/features/transactions/components/AddTransactionModal.tsx`, `mobile/src/features/accounts/components/AccountPicker.tsx`
**Related reports:** `2026-09-21-add-transaction-redesign-double-check.md`, `2026-09-21-comment-audit-repo-wide.md`, `2026-09-21-infra-audit.md`, `2026-09-21-infra-audit-tier1-fixes.md`

## Method

- Diffed the scoped file set against `HEAD` and read `mobile/src/features/categories/components/CategoryGrid.tsx` in full (untracked, new this session).
- Delegated a combined Part A (comment-only) / Part B (health/correctness) sweep to a general-purpose subagent, instructed to check specifically against `CLAUDE.md` Part 7 rules 14/15, the new `compact` `AccountPicker` mode, the new web `preventInputBlur` pattern, and cross-reference the earlier `add-transaction-redesign-double-check.md` report.
- Verified every agent finding against the live repo myself before fixing (grep/read each cited location).
- `npx tsc --noEmit -p mobile/tsconfig.json`, `npm run test -w mobile`, `node scripts/check-contract-parity.mjs`.
- Registered a real probe user against the (now-migrated) local API, exercised `GET /wallets`, `GET /categories`, `GET /accounts`, `POST /transactions` with real non-empty data, then deleted the probe user and every dependent row by its unique id.

## Findings

1. **Stale doc comment** (`CalculatorKeypad.tsx:12`) — `expressionRef`'s comment referenced `handlePress`, a function this session's rewrite removed (split into `insert`/`backspace`/`onConfirmRef.current()`/`onQuickDateRef.current()`). Confirmed stale. **Fixed.**
2. **Comment over CLAUDE.md's 1-2 line why-only limit** (`CalculatorKeypad.tsx:32`, the `preventInputBlur` doc comment) — 6 lines plus a URL citation, accurate but too long. Confirmed. **Fixed** — compressed to 2 lines.
3. **Row 1 misaligns with rows 2-4 when `onQuickDateRef` is absent** (`CalculatorKeypad.tsx`, affects every `MoneyInput` consumer — 6 screens) — 3 full-width digit cells vs. the other rows' 3-digit + 1-operator-pair 4-column shape. Confirmed real, but this is the *direct, deliberate* fix for the earlier-reported "awkward empty box" — the alternative (a reserved blank cell) is exactly what was removed on request. Not re-changed without product input; documented as an accepted trade-off. **No fix — accepted trade-off, see Follow-ups.**
4. **Parens/power keys removed entirely from the shared keypad** — silently makes the negative-multiplication workaround (`5×(−2)`) documented as accepted in `2026-09-21-add-transaction-redesign-double-check.md` (its Finding 8) unreachable, since `insertToken`'s operator-replace guard means a second operator glyph in a row (e.g. `×` then `−`) replaces rather than combines. Confirmed via `calculatorEngine.ts:265`. This was a deliberate design choice this session (matching the reference screenshot exactly), but it invalidates a previously-reviewed mitigation. **Not fixed — flagged for a product decision, see Follow-ups.**
5. **`AccountPicker`'s `compact` mode silently dropped the `error` prop** (`AccountPicker.tsx`) — no visual signal, no error text, unlike the non-compact branch. Harmless today (the sole caller, `AddTransactionModal`, doesn't pass `error` to the compact instance — it renders the equivalent error separately), but the prop stayed accepted and typed for `compact` callers, so a future one would have it silently swallowed. Confirmed. **Fixed** — compact mode now tints the badge danger-colored and shows the error line beneath the pill, mirroring the full-field behavior.
6. **`HAS_OPERATOR = /[+−×÷^]/` duplicated identically in two components** (`MoneyInput.tsx`, `AddTransactionModal.tsx`) instead of reusing `calculatorEngine.ts`'s own canonical operator-glyph set (which already backs `hasTrailingOperator`). Confirmed. **Fixed** — added `hasOperator()` to `calculatorEngine.ts` (reusing the existing `OPERATOR_GLYPHS`/`isOperatorGlyph`), both components now import it instead of defining their own regex. Added test coverage.
7. **3-way duplication of the "default to first item once the list loads" `useEffect`** (`CategoryGrid.tsx`, `CategoryPicker.tsx`, `AccountPicker.tsx`) — the 2-way case (`CategoryGrid`/`CategoryPicker`) was already reviewed and deliberately accepted in the prior double-check; `AccountPicker`'s copy predates this session and wasn't in that review's scope, but the shape is now 3-way. Low urgency given the earlier explicit call. **Not fixed — noted as a follow-up, matches a standing accepted decision.**

No commented-out code, no untracked `TODO`/`FIXME`, and no other stale comments found in the scoped diff. Rule 15 (`Pressable`/`View` `style`-as-function) and rule 14 (barrel/require-cycle discipline) both checked clean across every new/changed `Pressable` and cross-feature import in scope.

## Fixes Applied

- `mobile/src/utils/calculatorEngine.ts` — added `export function hasOperator(expression: string): boolean`, reusing `OPERATOR_GLYPHS`/`isOperatorGlyph`.
- `mobile/src/utils/calculatorEngine.test.ts` — added a `describe('hasOperator', ...)` block (2 tests).
- `mobile/src/components/CalculatorKeypad.tsx:11-14,32-33` — trimmed the two stale/oversized comments.
- `mobile/src/components/MoneyInput.tsx` — removed local `HAS_OPERATOR` regex, now imports and uses `hasOperator` from `@/utils` at all 3 call sites.
- `mobile/src/features/transactions/components/AddTransactionModal.tsx` — same removal; imported as `hasOperator as hasOperatorGlyph` to avoid shadowing the existing local `hasOperator` boolean.
- `mobile/src/features/accounts/components/AccountPicker.tsx` — compact mode now wraps the pill + an optional danger-toned error line in a `View`, and tints the icon badge (`dangerMuted`/`danger`) when `error` is set.
- Re-ran `npx tsc --noEmit`, `npm run test -w mobile` (165/165, up from 163 — the 2 new `hasOperator` tests), and `node scripts/check-contract-parity.mjs` (31/31) after every fix.

## Follow-ups

- **Resolved during this pass**: parens/power staying gone from the calculator keypad (making `5×(−2)` unreachable) was raised as a product decision and the user explicitly accepted it as a limitation — matches the "copy this exact style" reference screenshot, which had no parens key either. No further action.
- Row 1's 3-wide-vs-4-column misalignment when no date key is present is the direct, requested fix for the earlier "awkward empty box" report — flagging it here for visibility, not proposing to change it back.
- The now-3-way "default to first item" `useEffect` duplication (`CategoryGrid`/`CategoryPicker`/`AccountPicker`) is a `useDefaultToFirst(list, value, onChange)` extraction candidate, but a prior pass already made a deliberate call to leave the 2-way case as-is — low urgency, revisit only if a 4th copy appears.
