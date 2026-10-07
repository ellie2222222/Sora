# Double-check: starter-category translations, sign-up language, parent-category budgets

**Date:** 2026-10-06T05:32:56Z
**Method:** double-check skill
**Verdict:** PASS
**Scope:** The change set from the same day: `system_key` + `category_translations`, request-locale resolution, localized names on every read, rename-makes-custom, the sign-up language picker, and category budgets counting subcategories. Scoped from the conversation; whole-codebase sweep not requested.
**Files touched:** `SDS.md`, `SRS.md`, `server/src/categories/categories.service.ts`, `server/src/transactions/transactions.service.ts`, `server/src/ai/ai-tools.service.ts`, `mobile/src/services/guest/guestCategories.ts`, `mobile/src/app/providers/LocaleProvider.tsx`, `server/test/integration.categories.test.ts`, `mobile/src/services/guest/guestCategoryNames.test.ts`, `docs/test-plans/categories.md`
**Related reports:** 2026-10-06-category-translations-parent-budgets.md (the scratch-probe run this pass follows up; its two follow-ups remain open below)

## Method

- `aif-sdlc-checklist.md` re-read; items not yet satisfied were SDS §7/§8, SRS §9 acceptance criteria, and the `expo export` bundle.
- Phase 1 sweep delegated to a read-only agent over the diff: raw `categories.name` reads, guest display paths, readers of the removed `StarterCategory.name`, callers missing `categoryIds`, unused exports, duplicated subtree/locale logic, require cycles (Part 7 rule 14), name sorting. Each finding re-checked by hand before fixing.
- `npx expo export --platform android --output-dir <scratchpad>`
- `grep -rn "setRequestLocale\|runWithLocale\|connectionOnline\b"` (removed identifiers)
- `npm run typecheck`; `npm test`; disposable `postgres:17` container `scratch-i18n-15b2` on 127.0.0.1:55531: `node scripts/migrate.mjs --constraints`, then `npm test -w @sora/server` with `DATABASE_URL`; `docker rm -f -v scratch-i18n-15b2`; container and dangling-volume listings diffed against the baseline.

## Findings

1. **Guest duplicate-name check compared only the localized name** — `guestCategories.ts` `assertUniqueName`. A guest reading Vietnamese could create a custom root "Food" beside the starter Food (stored "Food", shown "Ăn uống"). The upload then creates "Food" on the server, which `uq_category_name_per_parent` rejects with a 409, so the guest upload fails. The server's `assertNameFree` had the same gap; there the index caught it, but as a raw constraint error rather than the service's clean check. FAIL → fixed.
2. **Cold-start locale race** — `LocaleProvider.tsx`: `appliedLocale` started `null`, so the first `applyLocale` after the async `bootstrapLocale()` never invalidated. Queries sent before it went out with `Accept-Language: en` and stayed cached in English for a `vi` user. FAIL → fixed.
3. **Dead raw-name select** — `transactions.service.ts` `categoryRow()` selected `name`, `icon` and `color`; `assertCategoryFits` reads only `type` and `wallet_id`. Removed.
4. **AI category sort relied on Postgres resolving an output alias before a table column** — `ai-tools.service.ts` `.orderBy('name')`. Now orders by the `localizedCategoryName` expression, as `categories.service.ts` does.
5. **SDS §2/§7 didn't mention `category_translations` / `system_key`; SRS §9 lacked acceptance criteria** for the language picker (AUTH-US-01), localized names and the localized duplicate rule (CAT-US-01/02), rename-makes-custom (CAT-US-03), and the subcategory roll-up (BUD-US-02). Added.
6. **Checked clean:**
   - every server read path that returns a category name goes through `localizedCategoryName`;
   - every guest display path goes through `guestCategoryName`;
   - no reader of `StarterCategory.name` remains;
   - every `BudgetSpendInput`/`BudgetResponse` construction carries `categoryIds`;
   - no unused new exports;
   - Accept-Language is set in one place;
   - no require cycle closes (`services/locale` imports only contracts, and nothing under `app/store` or `services/*` imports `@/app/providers`);
   - removed identifiers have no references;
   - `expo export`: "Android Bundled 32078ms mobile\index.js (3785 modules)", exit 0.

## Fixes Applied

- `server/src/categories/categories.service.ts` `assertNameFree` — matches a sibling's localized **or** stored name. Re-verified with a new integration test, "rejects a starter's stored English name while the caller reads it in Vietnamese" (`integration.categories:243`): PASS on the scratch database.
- `mobile/src/services/guest/guestCategories.ts` `assertUniqueName` — same two-name check. New test at `guestCategoryNames:49`: PASS.
- `mobile/src/app/providers/LocaleProvider.tsx` — `appliedLocale` starts at `activeLocale()`, so a saved language differing from the request default refetches. Not covered by an automated test (would need a provider render harness); typecheck and bundle clean.
- `transactions.service.ts`, `ai-tools.service.ts` — as findings 3 and 4.
- After all fixes:
  - `npm run typecheck` exit 0;
  - `npm test`: contracts 143/143, server 66/66, mobile 638/638;
  - scratch DB: constraint suites PASS, `npm test -w @sora/server` 242/242, 0 skipped;
  - teardown diff clean.

## Follow-ups

- Carried from 2026-10-06-category-translations-parent-budgets.md: run the app once (sign up in Tiếng Việt, switch language), and guest wallet/Cash names are still English-only.
- AI transaction proposals store `categoryName` in `action_payload` in the language they were drafted in; an old proposal keeps that language after a switch. Snapshot by design today; worth deciding.
- The dashboard's category grouping (`mobile/src/utils/dashboardAnalytics.ts`) groups by direct parent only, while budgets roll up at any depth. That's consistent for today's two-level trees, but the two would diverge with three levels.
- Small duplication, not fixed this pass:
  - `categories.service.ts` `descendantLevels` overlaps `categorySubtreeIds` for the archive paths;
  - mobile `SUPPORTED_LOCALES` restates contracts `LOCALES`;
  - "invalidate every tag" is written in both `LocaleProvider` and `syncEngineRuntime`.
