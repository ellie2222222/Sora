# Modal/form consistency review: dates, budget windows, duplicate picker

**Date:** 2026-09-16T00:00:00Z
**Method:** ad hoc (full consistency review per `plans/mobile/modal-ui-form-plan.md`'s review brief)
**Verdict:** PASS — typecheck/tests clean; not visually re-verified on device (see Follow-ups)
**Scope:** Every item flagged in `MODAL_UI_STATE.md`'s audit, individually re-verified against the
real database/domain model, `packages/contracts/src/schemas.ts`, and SRS.md before touching any
code — not implemented blindly.
**Files touched:** see Files Changed below
**Related reports:** `mobile/MODAL_UI_STATE.md` (the audit this pass verified and acted on)

## Method

For each flagged item, traced UI → request DTO → Zod schema → migration/business rule, per the
review brief. Ground truth checked: `packages/contracts/src/schemas.ts` (`createBudgetSchema`,
`createContributionSchema`, `createGoalSchema`, `currencySchema`), `db/migrations/
001_initial_wallet_schema.sql` (budget/category FK shape), and `SRS.md` (BUD-US-01, SAV-US-02,
FR-38, FR-44).

## Findings — verified against source of truth, then fixed

1. **`AddBudgetModal` never captured a real start/end window — confirmed a genuine SRS violation,
   not just a UX nicety.** `createBudgetSchema` (schemas.ts:325-339) requires `startDate`/`endDate`
   as real, arbitrary, user-suppliable ISO dates (`endDate >= startDate` enforced server-side), and
   `BUD-US-01`'s acceptance criteria literally lists "a start and end date... inclusive on both
   ends" as captured input — not a server-computed value. The prior implementation computed both
   dates from `today()` for every period type and never showed or accepted them, and its `WEEKLY`
   branch reused the `MONTHLY`/`CUSTOM` `addMonths(startDate, 1)` fallback, silently creating a
   one-*month* budget for "Weekly." **Fixed**: added real `startDate`/`endDate` `DateField`s,
   pre-filled with a sensible default per period type (`defaultWindowFor`) that only applies while
   the user hasn't touched the dates directly (`datesTouched`), plus a client-side
   `endDate < startDate` check mirroring the server's own validation message.
2. **`AddContributionModal` hardcoded `contributionDate: nowInstant()`, never asking the user —
   confirmed a genuine SAV-US-02 violation.** The story's acceptance criteria: "Captures an amount,
   an account, **a date**, an optional note..." `createContributionSchema.contributionDate` is a
   real required field (`isoDateTimeSchema`) already being sent — only the UI control was missing.
   **Fixed**: added a `DateField`, defaulting to today, converted via `instantOfDay` at submit.
3. **`AddGoalModal`'s raw `YYYY-MM-DD` text field for `targetDate`** — not itself an SRS violation
   (FR-44 only says "optional," no format mandate), but a real inconsistency with the
   already-established `DateField` → `DatePickerModal` pattern used everywhere else dates are
   captured, which the review brief's §11 explicitly asks to reuse rather than reintroduce raw text
   for. `targetDate` is optional and nullable (`createGoalSchema.targetDate: isoDateSchema.nullish()`),
   which `DateField` didn't support (always-required `value: string`). **Fixed**: extended
   `DateField` to accept `value: string | null` plus an optional `onClear`/`placeholder`, backward
   compatible with its three existing required-date callers (a plain `string` still satisfies
   `string | null`), then wired `AddGoalModal` to it.
4. **`AddTransactionModal` rendered two near-identical `AccountPicker` blocks** (Expense/Income),
   gated on `fields.fromAccount`/`fields.toAccount`, which `fieldsForType` never sets both true for
   — only one ever rendered, both bound to the same `primaryAccount`/`setPrimaryAccount`. Pure
   duplication, zero behavior difference. **Fixed**: collapsed to one conditional block.

## Findings — verified, then deliberately NOT implemented

5. **`AddAccountModal`'s freeform 3-letter currency code.** `currencySchema` (schemas.ts:43-45) is
   `/^[A-Z]{3}$/` — a format check, not a lookup against any canonical list. No `CURRENCIES`/
   currency-name table exists anywhere in `packages/contracts` or the schema. A currency *picker*
   would have to invent a list the domain model doesn't have — exactly the "speculative product
   decision" the review brief says not to make. Left as-is.
6. **Multi-category budgets** (a `MODAL_UI_STATE.md` "high-value opportunity"). `budgets.category_id`
   is a singular FK (migration 001) and `excl_budget_overlap` is defined per-category — the schema
   has no shape for a budget spanning several categories. Not implemented, per the review brief's
   explicit instruction not to build this "unless the real backend/domain model supports it."

## Business Logic Verification

- FR-38 (period type is a descriptive label, the window is what's enforced) — now actually true in
  the UI; previously the "label" secretly *was* the only thing that mattered.
- BUD-US-03 / FR-41 (start/end dates immutable after creation) — confirmed `updateBudgetSchema`
  (schemas.ts:341-347) only accepts `name`/`amount`/`status`; `BudgetDetailScreen`'s edit flow
  already matches this and needed no change.
- SAV-US-02's "record as expense vs. earmark" branch, and its category requirement, were untouched
  — only the date capture was missing.

## Data Model Verification

| UI field | Request field | Schema | Verified |
|---|---|---|---|
| `AddBudgetModal` start/end `DateField`s | `startDate`/`endDate` | `createBudgetSchema` (`isoDateSchema`, `endDate >= startDate`) | Matches `CalendarDay` (`YYYY-MM-DD`) shape exactly, no conversion needed |
| `AddContributionModal` `DateField` | `contributionDate` | `createContributionSchema` (`isoDateTimeSchema`) | Converted via `instantOfDay` — a calendar day, not an instant, is what the UI collects |
| `AddGoalModal` `DateField` | `targetDate` | `createGoalSchema` (`isoDateSchema.nullish()`) | A nullable string now flows straight through, no `.trim()` string-sentinel logic needed |

## User Story Verification

- **BUD-US-01** — create-budget form now actually captures the window the story describes, for
  every period type, not just implicitly for a hardcoded month.
- **SAV-US-02** — contribution form now captures all four listed fields (amount, account, date,
  note) plus the record/earmark choice; previously the date was silently fixed to "now."
- **SAV-US-04** / **BUD-US-03** — unaffected; confirmed their edit-only, immutable-window/date
  behavior still holds.

## UI/UX Changes

- `AddBudgetModal`: two new `DateField`s (Start date / End date), period-type pills now pre-fill a
  sensible default window instead of silently deciding it.
- `AddContributionModal`: one new `DateField` (Date), inserted after Amount.
- `AddGoalModal`: raw text `Input` → `DateField` (optional, clearable) for Target date.
- `AddTransactionModal`: no visible change — two duplicate JSX blocks became one.
- `DateField` (shared component): now supports an optional/nullable value with a clear affordance,
  used by `AddGoalModal`; the three pre-existing required-date callers are unaffected.

## Reused Existing Patterns

- `DateField` → `DatePickerModal` (extended, not replaced, not duplicated).
- `MoneyInput`, `AccountPicker`, `CategoryPicker`, `BottomSheetModal` — untouched, reused as-is.
- The existing `error`-string-plus-manual-pre-check pattern already used for `AddBudgetModal`'s
  category check, mirrored for the new start/end date check.
- `t(key, { defaultValue })` fallback convention, matching every other ad hoc string in these same
  files.

## Validation

- `npm run typecheck -w @sora/mobile` — clean.
- `npm run test -w @sora/mobile` — 153/153 (unchanged; no existing test exercises these forms'
  rendering).
- Lint: not run as a separate step — no dedicated lint script found bound in `mobile/package.json`
  beyond typecheck/test.
- E2E: none exist in this repo for these modals; not run.

## Remaining Issues

- Not visually verified on a device/simulator — this pass was implemented and reasoned through
  against the schema/SRS, not click-tested.
- The four new/changed `t()` keys (`budgets.startDate`, `budgets.endDate`,
  `budgets.endBeforeStartError`, `goals.noTargetDate`) rely on their inline `defaultValue` fallback
  rather than being added to `en.ts`/`vi.ts` yet — the same pattern already used pervasively
  elsewhere in these same files, not a gap introduced by this pass, but worth a dedicated i18n
  sweep at some point.
- `AddAccountModal`'s currency field and multi-category budgets were investigated and correctly
  left alone (see Findings 5–6) — flagged here so a future pass doesn't reopen them without first
  checking whether the domain model has since grown the support they'd need.
