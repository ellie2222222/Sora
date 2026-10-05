# Fix pass for the mobile design-token audit: nested radius, control borders, toast accent, and a CI gate

**Date:** 2026-10-04T16:54:30Z
**Method:** ad hoc
**Verdict:** PASS
**Scope:** Every follow-up from [2026-10-04-mobile-design-token-audit.md](2026-10-04-mobile-design-token-audit.md) that the user approved: the 6 nested-radius FAILs, the 2 control border colours, the toast accent, the guideline/token mismatch, and mechanical enforcement. Also covers the `w-[22%]` class the new gate flagged.
**Files touched:** `mobile/src/design-system/{radius.ts,radius.test.ts,tokens-usage.test.ts}`, `mobile/src/components/{ThemeToggle,MoneyInput,DatePickerModal}.tsx`, `mobile/src/features/categories/components/CategoryPicker.tsx`, `mobile/src/features/chat/components/ChatInputBar.tsx`, `mobile/src/features/planning/screens/PlanningScreen.tsx`, `mobile/src/features/transactions/components/{TransactionListScreen,TransactionListSkeleton}.tsx`, `mobile/src/app/providers/ToastProvider.tsx`, `docs/DESIGN_GUIDELINES.md`
**Related reports:** [2026-10-04-mobile-design-token-audit.md](2026-10-04-mobile-design-token-audit.md) (this pass closes its Medium items 1–3 and Low items 4–7)

## Method

```bash
npm run typecheck -w @sora/mobile
npm run test -w @sora/mobile
node --test mobile/src/design-system/tokens-usage.test.ts mobile/src/design-system/radius.test.ts
# Gate proof: plant a violating file, run the gate, remove the file by its exact name
printf "export const probe = { borderWidth: 2, padding: 8 };\nexport const C = () => <View className=\"p-4\" />;\n" > mobile/src/components/scratch-token-probe.tsx
node --test mobile/src/design-system/tokens-usage.test.ts   # expect 3 failures naming the probe
rm -- mobile/src/components/scratch-token-probe.tsx
```

## Findings

- **Gate on a clean tree.** First run of `tokens-usage.test.ts` → 1 failure: `components/DatePickerModal.tsx:210 className="w-[22%] …"` (the audit's Low #7). After the fix → 11/11 pass.
- **The gate catches regressions.** With the probe file planted, it failed on `sets no border width as a literal`, `gives no style property a literal number` and `uses only token-named NativeWind classes`, each naming `components/scratch-token-probe.tsx`. With the probe removed (`ls` → "No such file"), all pass. PASS.
- **Rule control cases.** `the token rules themselves` asserts each matcher flags a literal and passes the token form (e.g. `borderWidth: 2` flagged, `borderWidth: theme.borderWidth.thin` passes; `p-4` flagged, `py-sm` passes). PASS.
- **Tailwind mirror.** `spacing`, `borderRadius` and `fontSize` in `tailwind.config.js` equal the TS tokens key for key. PASS.
- **`concentricRadius`.** 12 − 2 → 10; md 10 − thin 1 − xxs 2 → 7; no inset → outer; floors at 0. PASS.
- **Full suite.** `npm run test -w @sora/mobile` → 613 pass, 0 fail. `npm run typecheck -w @sora/mobile` → no errors. PASS.

## Fixes Applied

| Audit item | Change | Re-verified by |
|---|---|---|
| Nested radius #1–3 (segmented controls) | `PlanningScreen.tsx:245,266`, `TransactionListScreen.tsx:364`, `TransactionListSkeleton.tsx:65`: segment radius `radius.sm` (6) → `concentricRadius(radius.md, borderWidth.thin, spacing.xxs)` (7) | typecheck; radius.test.ts |
| Nested radius #4 (ThemeToggle) | `ThemeToggle.tsx`: `padding = thumbInset − borderWidth.thin`, `travelDistance` uses `thumbInset`, thumb radius `concentricRadius(trackHeight / 2, thumbInset)`. The thumb now sits `(trackHeight − thumb) / 2` from every edge instead of 4px left / 2px right | typecheck; arithmetic in the code comment |
| Nested radius #5 (ChatInputBar) | `ChatInputBar.tsx:106`: send button `radius.pill` → `concentricRadius(radius.xl, borderWidth.thin, sendInset)` (13) | typecheck |
| Nested radius #6 (button in padded Card) | Not changed in code. The guideline now limits the rule to an inset under half the outer radius; a `Button` behind a `Card`'s `spacing.md` keeps its own radius instead of shrinking to a near-square 1 | DESIGN_GUIDELINES Radius |
| Control border colour | `MoneyInput.tsx:156`, `CategoryPicker.tsx:51`: resting `colors.border` → `colors.borderControl` | typecheck |
| Rounded single-sided accent | `ToastProvider.tsx`: dropped `borderLeftWidth`/`borderLeftColor`; the accent is now an inset bar (`borderWidth.thick` wide, `radius.pill`) inside the padding | typecheck |
| Guideline vs token scale | DESIGN_GUIDELINES Radius, Borders, Cards, Design tokens and Part 4: nested rule includes border width; widths described as `thin`/`medium`/`thick` (no "0.5–1px" or "2px"); `border` vs `borderControl`; the gate is documented | read back |
| Mechanical enforcement | New `tokens-usage.test.ts` and `radius.test.ts`, picked up by the existing `src/**/*.test.ts` glob, so CI runs them with no `ci.yml` change | gate proof above |
| NativeWind arbitrary class | `DatePickerModal.tsx:210`: `w-[22%]` → `style.width: '22%'` | gate re-run |

## Follow-ups

- Not checked on a device: the ThemeToggle thumb position, the 7px segments, the 13px send button and the toast bar. Reload with `npm run dev:mobile:clear`.
- Still open from the audit: `RootNavigator.tsx:80–83` font-family strings, `DatePickerModal.tsx:134` `fontWeight: 'bold'`, `ToastProvider.tsx` module-level `spacing` import, and the unused `tabBarMetrics.ts` (deleting it needs approval).
- The gate is line-based: a value split across lines, or a computed literal (`const w = 2; borderWidth: w`), gets past it. ESLint `no-restricted-syntax` would close that, but it adds a dependency.
- The three segmented controls are copies of one another; extracting a `SegmentedControl` component would leave one place to keep the radius right.
