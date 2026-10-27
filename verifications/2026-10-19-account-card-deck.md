# Account card deck, card details, network logos, Home summary clipping

**Date:** 2026-10-19T07:58:06Z
**Method:** ad hoc
**Verdict:** PASS
**Scope:** Uncommitted work since 21999a8: accounts carousel (deck, skins, backlight), card details (migration 006 → contracts → server → guest store → forms), network logos, Home period-summary clipping
**Files touched:** see `git status`; this pass also edited `docs/DESIGN_GUIDELINES.md`, `docs/test-plans/accounts.md`
**Related reports:** 2026-10-19-double-check-offline-first.md

## Method

- `npm run typecheck`; `npm run test -w @sora/mobile`; earlier in the session `npm test -w @sora/contracts`, server suite with integration on a scratch DB, `node scripts/check-contract-parity.mjs`, `db/tests/004_account_card_details.sql`
- Release APK (`./gradlew assembleRelease --no-daemon -PreactNativeArchitectures=x86_64`) on emulator `Medium_Phone` against the API on scratch DB `scratch_e2e_offline`
- Frames: `adb shell dumpsys gfxinfo com.sora.app reset`, 3 swipes left + 3 right across the deck (`input swipe … 400`), then `dumpsys gfxinfo` janky % and percentiles
- Screenshots: Home tab, Dashboard → Accounts deck

## Findings

1. Typecheck → exit 0. Mobile tests → 791/791 pass. Contracts 180/180, server 302/302, parity 141/141, db probes pass (earlier this session). PASS
2. Card details over HTTP → `cardLast4` on a CASH account answered 422 with a field error. PASS
3. Deck smoothness, gfxinfo over 6 swipes:

   | Build | Janky | p50 | p90 | p95 |
   |---|---|---|---|---|
   | First deck | 23.15% | 31ms | 65ms | 77ms |
   | Memo + mount window | 9.69% | 29ms | 40ms | 48ms |
   | z-order as props | 7.09% | 30ms | 38ms | 42ms |
   | No backlight (diagnostic) | 4.76% | 18ms | 27ms | 32ms |
   | SVG gradient backlight, warm run 1 | 6.43% | 26ms | 32ms | 34ms |
   | SVG gradient backlight, warm run 2 | 9.74% | 28ms | 34ms | 48ms |
   | Home list scroll (control) | 5.06% | 18ms | — | — |

   The first run after install read 15.54% (cold JIT) and is excluded. PASS: the tail is about half of the first deck's. Emulator figures vary between runs by about ±3 points.
4. Logos → deck screenshot shows the neighbour credit card's Visa mark drawn white; the gradient glow sits around the front card unclipped. PASS
5. Home summary clipping → after the `paddingTop: spacing.sm`/`paddingBottom: spacing.md` wrapper in `TransactionListScreen.tsx`, the period summary card shows all four rounded corners and its shadow above the filter bar. PASS

## Fixes Applied

- Glow clipped by the section → `glowRoom` derived from `BACKLIGHT.reach`; re-checked on the deck screenshot.
- Drag jank → memo cards, mount window of 3, z-order as plain props, blurred boxShadow replaced by an SVG radial gradient; re-measured (table above).
- Home summary clipped → wrapper padding; re-checked on the Home screenshot.
- Stale docs → DESIGN_GUIDELINES backlight/logo text, TC-ACC-22 anchors.

## Follow-ups

- The user's dev DB (`sora_dev`) needs `npm run db:migrate` (migration 006) before card details save; logos show only on accounts with a network set.
- TC-ACC-23 stays Partial: Reduce Motion was not exercised on a device.
