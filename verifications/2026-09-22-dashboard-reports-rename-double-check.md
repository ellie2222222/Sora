# Double-check of the features/reports ↔ features/dashboard rename and wallet-loading fix

**Date:** 2026-09-22T00:00:00Z
**Method:** double-check skill
**Verdict:** PASS
**Scope:** The `features/dashboard`→`features/home` / `features/reports`→`features/dashboard` swap (navigation, i18n across all 10 locale files, barrels), the wallet-loading-race fix in `DashboardScreen.tsx`, and the two plan docs written/moved alongside it (`plans/architecture/dashboard-current-state.md`, `plans/architecture/dashboard-feature-roadmap.md`). Everything else in `git status` (server/, packages/contracts/, CLAUDE.md, docker-compose.yml, etc.) predates this work and is out of scope.
**Files touched:** `plans/architecture/dashboard-current-state.md` (one wording fix; see Fixes Applied)
**Related reports:** `2026-09-22-calculator-keypad-followup-double-check.md` (immediately prior pass, unrelated scope — calculator keypad, not the dashboard rename)

## Method

- Read the most recent verification report first; its Follow-ups were calculator-keypad-specific, nothing to carry forward into this scope.
- Delegated Phase 1 (repo-wide stale-reference sweep, barrel/import discipline, locale structural parity, testID collisions, wallet-loading-fix correctness, plan-doc-vs-code drift) to an independent Explore agent instructed to verify against the live repo, not trust the session's own summary.
- Independently re-verified the agent's one flagged item against the live repo myself before deciding whether to act on it, per this skill's "verify before fixing" rule.
- Ran `npx tsc --noEmit -p mobile/tsconfig.json`, `npm run test -w mobile`, `node scripts/check-contract-parity.mjs`.

## Findings

1. **Repo-wide stale-reference sweep** (`features/reports`, `ReportScreen`, `nav.report`, `reports.*` i18n keys, the old unused `dashboard:` i18n block) — clean. Every remaining hit is either a dated historical verification report (expected), the new doc's own "here's what changed" narration, or a gitignored Metro dev log (`mobile/.expo/dev/logs/start.log`, confirmed via `git check-ignore -v` — not tracked). No live code or doc references the old names.
2. **Barrels and import discipline (rule 14)** — `features/home/index.ts` and `features/dashboard/index.ts` both correct; only `MainTabNavigator.tsx` imports either, via the `@/features/...` barrel. Clean.
3. **Locale structural consistency (rule 13)** — all 10 locale files have exactly one `dashboard:` block and zero `reports:` blocks. `vi.ts` has 100% key parity with `en.ts` for both `dashboard:` (18 keys) and `nav:` (5 keys) — also proven independently by `vi.ts`'s `const vi: TranslationResource = {...}` direct type annotation, which makes `tsc --noEmit` itself an excess/missing-property check, and it passed clean. The 8 inactive locales correctly kept their untouched (now slightly stale, e.g. still saying "reports" in translated prose under the renamed `dashboard:` key) text — per rule 13, that's the required behavior, not a defect.
4. **testID collisions** — `DashboardScreen.tsx`'s 7 testIDs and the auto-derived `tab-dashboard` each appear exactly once repo-wide. Clean.
5. **Wallet-loading-race fix correctness** — `DashboardScreen.tsx` destructures `isLoading: walletsLoading`, checks it before `activeWalletId === null`, and only reaches the branches that pass `activeWalletId` as a non-null `walletId` prop after both loading checks clear. Confirmed consistent with the same fix's shape in the other 4 files touched earlier this session (`AddTransactionModal.tsx`, `BudgetDetailScreen.tsx`, `GoalDetailScreen.tsx`, `CategoryListScreen.tsx`).
6. **Plan docs vs. live code** — spot-checked the highest-drift-risk claims (file:line citations, "nothing else calls X" claims) rather than re-deriving everything already reviewed twice; all confirmed accurate. One minor imprecision found: `dashboard-current-state.md`'s "Mobile consumption" bullet described `MonthlyReport`'s current+previous-month fetch and `YearlyReport`'s 12-month fetch as one unified flow, when they're two separate code paths with different shapes (no previous-year comparison call in the yearly case). **Fixed.**
7. **One flagged item, independently re-verified and found to be a false positive**: the sweep flagged `HomeScreen.tsx:1`'s `import { useModal } from '../../../app/providers/ModalProvider.tsx'` as a deep-relative import that should go through the `@/app/providers` barrel per rule 14. Checked `app/providers/index.ts` directly — it has an explicit comment: `ModalProvider is intentionally NOT re-exported here: it reaches into many features' modal components, and being barrel-exported alongside them would create a require cycle... Import it directly.` Grepped every `useModal` consumer (`GoalDetailScreen.tsx`, `TransactionsScreen.tsx`, `AccountsScreen.tsx`, `HomeScreen.tsx`, `PlanningScreen.tsx`) — all 5 use the identical direct-relative-path pattern. This is the deliberate, established, consistent convention, not a violation. **No fix — verifying before fixing caught this before it became an incorrect "fix" that would have reintroduced the require cycle rule 14 already documents.**

## Fixes Applied

- `plans/architecture/dashboard-current-state.md:64-69` — reworded the `DashboardScreen.tsx` mobile-consumption bullet to describe `MonthlyReport` and `YearlyReport`'s fetch patterns as the two distinct code paths they actually are, instead of one conflated flow. Re-verified by re-reading `DashboardScreen.tsx` against the new wording.
- `npx tsc --noEmit -p mobile/tsconfig.json` — clean.
- `npm run test -w mobile` — 165/165.
- `node scripts/check-contract-parity.mjs` — 31/31.

## Follow-ups

None. The rename, the i18n merge across all 10 locales, the wallet-loading fix, and both plan docs all hold up against independent re-verification.
