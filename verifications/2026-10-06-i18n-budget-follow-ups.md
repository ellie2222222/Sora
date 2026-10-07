# Follow-ups from the category-i18n double-check

**Date:** 2026-10-06T06:26:29Z
**Method:** ad hoc (scratch-probe procedure for the database run)
**Verdict:** PASS (on-device app run BLOCKED — no device or emulator attached)
**Scope:** The open follow-ups in 2026-10-06-double-check-category-i18n-parent-budgets.md:
- AI proposal names;
- dashboard grouping depth;
- guest wallet/Cash naming;
- duplicated locale list and "invalidate everything";
- the server subtree walk;
- the on-device run.
**Files touched:** `server/src/ai/ai.service.ts`, `server/src/auth/auth.service.ts`, `packages/contracts/src/starter-categories.ts`, `mobile/src/utils/dashboardAnalytics.ts`, `mobile/src/features/dashboard/components/{CategoryBreakdown,PeriodReport}.tsx`, `mobile/src/services/guest/guestSeed.ts`, `mobile/src/features/wallets/components/WalletSwitcher.tsx`, `mobile/src/features/guest/screens/GuestUploadScreen.tsx`, `mobile/src/app/i18n/index.ts`, `mobile/src/app/store/api/apiSlice.ts`, `mobile/src/services/sync/syncEngineRuntime.ts`, `mobile/src/app/providers/LocaleProvider.tsx`, `CLAUDE.md` (Part 7 rule 13), `docs/API_SPECIFICATION.md` §17, tests and `docs/test-plans/{ai,auth,categories,guest}.md`
**Related reports:** 2026-10-06-double-check-category-i18n-parent-budgets.md, 2026-10-06-category-translations-parent-budgets.md

## Method

- `npm run typecheck`; `npm test`; `node scripts/check-contract-parity.mjs`; `npm run agents:check`
- `npx expo export --platform android --output-dir <scratchpad>`
- Disposable `postgres:17` container `scratch-i18n-621d` on 127.0.0.1:55896:
  - `node scripts/migrate.mjs --constraints`
  - `DATABASE_URL=… npm test -w @sora/server`
  - `docker rm -f -v scratch-i18n-621d`
  - container and dangling-volume listings diffed against the baseline
- `adb devices`

## Findings

1. **AI proposals** — a stored proposal now names its category as the reader reads it now (`AiService.toMessageResponses`), falling back to the stored name. Test `integration.assistant:128` drafts in `en` and reads the history in `vi`: PASS.
2. **Dashboard grouping** — `groupByTopLevel` (renamed from `groupByParent`) rolls a slice up to its top-level category at any depth, matching the subtree a budget counts. The cyclic-chain guard is tested. `dashboardAnalytics` 25/25: PASS.
3. **Guest wallet/Cash** — the stored "Guest Wallet" is already a marker the screens replace with `wallets.yourWallet`, so it follows the language live. Localizing it at seed time would have bypassed that, so it stays, now as an exported `GUEST_WALLET_NAME` instead of three literals. The Cash account is seeded in the active language from contracts `STARTER_CASH_ACCOUNT_NAME`, the same source the server's `seedWallet` now uses, alongside `starterWalletName`. Tests at `guestCategoryNames:73`, `integration.auth:39` (registered "Ví của An" / "Tiền mặt") and `starter-categories:31`: PASS.
4. **Duplication**
   - `SUPPORTED_LOCALES` now re-exports contracts `LOCALES`; CLAUDE.md rule 13 is reworded to match.
   - `invalidateEverything()` in `apiSlice.ts` is shared by `LocaleProvider` and `syncEngineRuntime`.
   - The server's `descendantLevels` is deliberately kept: it returns levels in shallowest-first order, which the permanent delete needs so no child row outlives its parent; `categorySubtreeIds` returns a flat set.
5. **Test-plan references** — older references into `starter-categories.test.ts`, `integration.auth.test.ts` and `dashboardAnalytics.test.ts` had drifted from edits earlier today. They were remapped by test title against the committed versions (the working-tree diff of those files is this session's alone), and each was printed and checked to land on its test.
6. **Results**
   - typecheck exit 0;
   - `npm test`: contracts 144/144, server 66/66, mobile 641/641;
   - parity 65/65; agents in sync;
   - `expo export`: "Android Bundled 30513ms … (3785 modules)";
   - scratch database: constraint suites PASS, server 244/244 with 0 skipped;
   - teardown diff clean.
7. **On-device run** — `adb devices` lists nothing attached. BLOCKED, not a verdict on the change.

## Fixes Applied

See Findings 1–5; each was re-verified by the run in item 6.

## Follow-ups

- On a device or emulator: sign up choosing Tiếng Việt and confirm "Ví của …" / "Tiền mặt"; switch the language in Settings and confirm category names change on the dashboard, transactions and budgets; enter guest mode in Vietnamese and confirm "Tiền mặt".
- Have a native speaker review the Vietnamese starter names.
