# Calculator keypad for every money-amount field

**Date:** 2026-09-16T00:00:00Z
**Method:** ad hoc (feature build, no skill invoked)
**Verdict:** PASS
**Scope:** New always-visible calculator keypad + `MoneyInput` wrapper, wired into every money-amount
field app-wide per the user's explicit scope choice (transaction amount, budget amount, goal target
amount, goal contribution amount, account initial balance × 2 call sites).
**Files touched:** see below.
**Related reports:** none — new feature area, nothing prior to carry forward.

## Method

- `npm run build -w @sora/contracts` then `node --test mobile/src/utils/calculatorEngine.test.ts` — new
  evaluator unit tests.
- `npm run typecheck -w @sora/mobile` — full mobile typecheck after every edit round.
- `npm run test -w @sora/mobile` — full mobile suite (153 tests, up from 139).
- `npm run test -w @sora/contracts` — confirms the contract itself is untouched and still green (63
  tests).
- `git status --short` — confirms no stray files.

## Findings / build notes

- Surveyed every money-input call site via a research agent first (`Input.tsx`'s `keyboardType`-driven
  `formatCurrencyInput` behavior, and the 6 real call sites: `AddTransactionModal.tsx`,
  `AddBudgetModal.tsx`, `AddGoalModal.tsx`, `AddContributionModal.tsx`, `AddAccountScreen.tsx`,
  `AddAccountModal.tsx`). None of them called `parseMoney`/`formatMoney` before this change — they all
  passed the raw string straight to the mutation. `AddContributionModal.tsx` was the one exception: it
  used `parseFloat` for a client-side `>0` check, which is exactly the money-as-JS-number pattern
  CLAUDE.md Part 7 rule 1 forbids. Replaced with `parseMoney`/`isPositive` from `@sora/contracts` while
  already touching that field.
- `@sora/contracts` has no multiply/divide/power on `Scaled` (confirmed via fresh read of `money.ts` and
  `calc.ts`) — the evaluator's arithmetic (`mul`/`div`/`power`) is new, mobile-only UI logic in
  `mobile/src/utils/calculatorEngine.ts`. It reuses `parseMoney` for every number literal rather than
  reimplementing decimal parsing, so a typed literal is held to the exact same range/precision the
  server enforces (rule 7 — don't duplicate the contract).
- Division/multiplication round half-up to `MONEY_SCALE` (4 decimals); power requires a whole-number
  exponent (fractional exponents throw `CalculatorError`) and is bounded to ±12 to keep results in
  `DECIMAL(19,4)` range; a negative exponent computes a reciprocal.
- `tryEvaluate` never throws — used for the live, per-keystroke display; `evaluateExpression` throws
  `CalculatorError` and is what the tests exercise directly.
- `MoneyInput` needed a value-resync fix beyond the first draft: `AddTransactionModal.tsx` doesn't
  unmount on close (resets `amountText` via a `useEffect` instead of `if (!visible) return null` like
  the other five modals), so `MoneyInput`'s internal `expression` state would go stale across reopens
  without it. Added a `lastEmittedRef` to tell the component's own echo apart from an external reset and
  resync `expression` only in the latter case.
- `formatCurrencyInput` strips everything but digits/`.`, dropping a minus sign — caught before wiring
  finished, since the account `initialBalance` field is the one legitimately signed amount (VL-04, a
  credit card opens negative). `MoneyInput`'s display now formats the magnitude and re-applies the sign.
- `CalculatorKeypad` follows CLAUDE.md Part 7 rule 15 for its grid of `Pressable` keys: one
  `pressedKey: string | null` state for the whole grid (not one `useState` per key), plain-object
  `style`, never a function.

## Fixes Applied

N/A — first build of this feature, not a fix pass. All the corrections above were made during
implementation, before first typecheck/test run, not discovered by a later audit.

## Follow-ups

- None of the six call sites previously validated money client-side with `parseMoney` except the one
  `parseFloat` fix folded in above; server-side Zod validation was and remains the source of truth (VL-01).
- The keypad is always visible per the user's explicit choice, not a toggled/sheet-based mode — this
  adds a fixed ~250px of vertical space under every amount field. Not flagged as a defect, just worth
  knowing if a future design pass wants a collapsed variant.
- Not run against a real device/simulator — this was a logic + wiring pass verified through
  typecheck/unit tests, not `run`-skill UI verification. Flagging per the run skill's own guidance:
  visually confirming the keypad renders and responds to touch on-device is still open.
