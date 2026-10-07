# Goal deadline: quick options plus custom date, one sheet for create and edit

**Date:** 2026-10-05T09:54:55Z
**Method:** ad hoc
**Verdict:** PASS (unit, typecheck, bundle); sheet not driven on a device
**Scope:** the user's request to replace the goal's bare calendar with quick options and a custom date, and to make goal create and goal edit use one date UI.
**Files touched:** `mobile/src/components/DatePresetSheet.tsx` (new), `DatePickerModal.tsx`, `DateField.tsx`, `components/index.ts`; `mobile/src/features/goals/goalDeadlines.ts` (+test, new), `components/useGoalDeadlineSheet.ts` (new), `AddGoalModal.tsx`, `GoalEditCard.tsx`; i18n `en.ts`, `vi.ts`; `docs/DESIGN_GUIDELINES.md`, `SRS.md` SAV-US-01, `docs/test-plans/goals.md`, `mobile/MODAL_UI_STATE.md`
**Related reports:** [2026-10-05-recurring-budgets-hard-delete.md](2026-10-05-recurring-budgets-hard-delete.md)

## Method

```bash
node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON --test src/features/goals/goalDeadlines.test.ts
npm run typecheck -w @sora/mobile
npm run test -w @sora/mobile
npx expo export --platform android --output-dir <scratchpad>/bundle
```

## Findings

- **Audit.** Before this change there were two triggers. `AddGoalModal` used an `IconChip` and the keypad's date key; `GoalEditCard` used `DateField`. Both opened the bare `DatePickerModal`, with no presets and no lower bound. Each trigger stays native to its form: the keypad layout is shared by every create sheet, and `DateField` is the edit card's field style. What both open is now one sheet, `DatePresetSheet`, fed by `useGoalDeadlineSheet`.
- **Dates.** `goalDeadlinePresets(today())` returns, from 2026-10-05: end of this month 2026-10-31, in 3 months 2027-01-05, in 6 months 2027-04-05, end of this year 2026-12-31, in 1 year 2027-10-05, in 2 years 2028-10-05.
  - It reuses `addMonths`, `endOfMonth` and `endOfYear`; no new date maths.
  - Month-end days clamp: Aug 31 → Feb 28, and Feb 29 → Feb 28 a year later.
  - In December the two end-of dates coincide, so only "end of this year" is kept.
  - No preset is ever before today. 4/4 tests pass.
- **Past dates are allowed** (user decision, after a first pass that disabled them): the custom calendar accepts any day, and the API and contract are unchanged. Only the presets always lie ahead, by construction.
- `npm run typecheck`: clean. `npm run test -w @sora/mobile`: 631/631 (627 + 4 new). The test run includes `tokens-usage.test.ts`, so the new sheet uses only tokens. Android bundle: 3781 modules.

## Fixes Applied

As above.

## Follow-ups

- Not driven on a device:
  - the sheet's rows;
  - the Custom date row → calendar → closing both;
  - Back from the calendar;
  - picking a past custom day.
