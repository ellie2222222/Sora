# Double-check: uncommitted accounts / card / theme / wallet-switch work since 21999a8

**Date:** 2026-10-19T09:05:00Z
**Method:** double-check skill
**Verdict:** PASS
**Scope:** Every uncommitted change since 21999a8 (61 paths): card details end to end (migration 006 → contracts → server → guest → forms), account carousel and card face, network logos, credit-card liability handling, theme switch, wallet-switch overlay, tab freezing, docs. Large and cross-cutting, so Phase 1 ran.
**Files touched:** see Fixes Applied
**Related reports:** 2026-10-19-account-card-domain.md, 2026-10-19-account-card-deck.md (follow-ups carried: TC-ACC-22 anchors — fixed; "Owed" only on the deck card — still open)

## Method

- Re-read CLAUDE.md Parts 5 and 7; Phase 1 sweep by a read-only agent over `git diff` + untracked files, every finding re-grepped live before fixing.
- `npm run typecheck`; `npm run test -w @sora/contracts`; `npm run test -w @sora/mobile`; `npm run test -w @sora/server` (unit); `node scripts/check-contract-parity.mjs`; `git ls-files --eol` over changed files.

## Findings

1. Line endings → 25 changed files were CRLF in the working copy (Python edits on Windows) against `.gitattributes` `eol=lf`; one mixed. FAIL → fixed. `MainTabNavigator.tsx` is CRLF in HEAD itself; left as committed.
2. WalletSwitchOverlay → `minElapsed` never reset, so every switch after the first finished in its first commit; effect keyed on the wallet object, so a list refetch restarted both timers (6 s cap could slide); a switch to a wallet not in the list was never cleared. FAIL → fixed.
3. AccountCarousel → `accessible` deck had no `activate`, so a screen-reader user could not open an account; front card tracked by index, so an offline create (`unshift`) changed the front account. FAIL → fixed.
4. ThemeProvider → two taps in one frame could leave the screen and the saved preference disagreeing (the "changed" check read a ref updated only after the frame). FAIL → fixed. Pre-existing malformed web CSS (`* {` dangling, duplicate `color` line) → fixed.
5. AccountsOverview skeleton → 200 px block vs a ~300 px deck, content jumped on load. FAIL → fixed.
6. AccountEditForm → `asSent` untrimmed vs trimmed comparison marked a trailing space as a change. FAIL → fixed.
7. Duplication → `accountBalance.ts` re-implemented `tryParseMoney`/`absScaled`; card height and glow reach computed 2–3 times. Fixed.
8. Server → `accountRow` SELECT ran on every PATCH even without card details. Fixed (guarded).
9. Dead code / removed refs → none of `backlight(`, `MASTERCARD_LOGO_COLORS`, `AnimatedThemeRoot`, `beginTransition`, `layer` prop remain; all new exports and the 12 new i18n keys are referenced. `NetworkLogo`'s redundant `onCard` prop removed. PASS
10. Rules → rule 15 (no function `style` on Pressable), MB-10 imports, MB-08 money, MB-09 parity (10 locales, placeholders) clean. NetworkLogo spoke "AMEX"/"UNIONPAY" → now `CARD_NETWORK_NAME`. networkLogoData claimed a generator that does not exist → header corrected. Misplaced/inaccurate comments (carouselLayout `visibleRange`, "peeks out", `CARD_LOOK` doc on `type Texture`, a restating JSX comment) fixed.
11. Cross-layer → `AccountResponse` card fields consistent across contracts, server, guest, optimistic records; validation identical in `cardDetailIssues`, server update, guest update, DB CHECKs. API spec did not say responses carry the fields → added (§9.1). PASS after fix.
12. Docs → DESIGN_GUIDELINES carousel text (second neighbour, names row, tint vs skin), wallet-switch overlay undocumented and against "The shell always renders", `freezeOnBlur` undocumented → all amended (guidelines exception, SDS tab bar paragraph). Test plan TC-ACC-22 anchors refreshed, TC-ACC-25 added.

## Fixes Applied

- `mobile/src/app/providers/WalletProvider.tsx` — `finishSwitch(walletId)` ends only that switch; switch cleared when the target cannot become active.
- `mobile/src/features/wallets/components/WalletSwitchOverlay.tsx` — one `SwitchingScreen` per switch (keyed by wallet id); selector moved to `mobile/src/app/store/apiActivity.ts` and only subscribed during a switch.
- `mobile/src/features/accounts/components/AccountCarousel.tsx` — front card kept by account id; `activate` action; `deckGeometry` + `AccountCarouselSkeleton`; height/reach passed down once.
- `mobile/src/app/providers/ThemeProvider.tsx` — setters always schedule (ordered) updates; web CSS repaired.
- `mobile/src/features/accounts/accountBalance.ts`, `AccountEditForm.tsx`, `AccountsOverview.tsx`, `NetworkLogo.tsx`, `networkLogoData.ts`, `AccountCard.tsx`, `carouselLayout.ts` (+ test name) — as in Findings.
- `server/src/accounts/accounts.service.ts` — card-detail check (and its SELECT) only when the PATCH carries card details.
- Docs: `docs/DESIGN_GUIDELINES.md`, `SDS.md`, `docs/API_SPECIFICATION.md`, `docs/test-plans/accounts.md`.
- Same pass, at the user's request: carousel loops for 3+ cards (`deckLoops`, `deckOffset`, `deckFrontIndex`, `deckTargetFor`, `deckFadeEnd` + 6 tests); hidden tabs frozen (`freezeOnBlur`); backlight as a soft oval gradient.
- Same pass, at the user's request: dark/light switch as a 200 ms ease-in-out whole-screen crossfade (`useThemeCrossfade` in `ThemeProvider.tsx`): snapshot via `react-native-view-shot` 5.1.0 (added with `npx expo install`; `node scripts/audit-runtime-deps.mjs` → no unaccepted advisories; npm audit lists it only "via react-native"), theme switched under it, snapshot faded out. Loaded lazily, so a build without the native module switches instantly instead of failing at start (`TurboModuleRegistry.getEnforcing` throws on import). Web CSS transition set to 200 ms ease-in-out.
- Re-verified after all fixes: `npm run typecheck` exit 0; contracts 184/184; mobile 803/803; server unit 104/104; parity 141/141.

## Follow-ups

- Server integration suite (needs a Postgres) not re-run after the PATCH guard; last run 302/302 earlier today before it. The guard only skips a check that returns no issues without card fields.
- Not exercised on a device: loop, theme crossfade, wallet overlay, skeleton (user stopped emulator runs).
- The crossfade needs the dev build rebuilt once (`npm run dev:mobile:build`); until then switches are instant.
- Account detail and transaction rows still show a credit card balance signed (from 2026-10-19-account-card-domain.md).
- Invisible cards at opacity 0 beyond the neighbours can still take a tap in the strip past a neighbour's edge (pre-existing).
- `check-contract-parity.mjs` cannot check `accounts.institution_name` length: `columnLength` parses only `CREATE TABLE`, and 006 adds it with `ALTER TABLE`.
- testID naming drift: `btn-select-account-<id>`, `input-account-institution`/`-last4` vs NC-04 patterns; left, since renaming touches E2E selectors.
- TC-ACC-20/21 still describe overview cards on identity tints; `colors:288` anchor off.

## Follow-up pass (same day)

- "Owed" everywhere a credit card balance shows → `AccountBalance` (`mobile/src/features/accounts/components/AccountBalance.tsx`) used in `AccountDetailModal`, `AccountPicker`, `WalletDetailPanel`. Closed.
- Faded cards beyond the neighbours took taps → `pointerEvents` set per card from its offset (`useAnimatedProps`, `AccountCarousel.tsx`). Closed.
- Parity could not see `ALTER TABLE` columns → `columnLength` also reads `ALTER TABLE ... ADD COLUMN`; `institutionName` → `accounts.institution_name` added. `node scripts/check-contract-parity.mjs` → 143/143; the pattern reads `VARCHAR(40)` from a sample `ALTER TABLE`, so a `.max(60)` against it would fail. Closed.
- testIDs → `option-account-deck-<id>`, `input-account-institutionName`, `input-account-cardLast4`, `btn-account-cardNetwork-<network>`; no E2E flow referenced the old ones. Closed.
- TC-ACC-20/21 → describe the tint as the account sheet's badge, anchor `colors:295`; tint clause dropped from TC-ACC-21. Closed.
- Re-verified: `npm run typecheck` exit 0; contracts 184/184; mobile 803/803; server unit 104/104; parity 143/143; changed files LF (MainTabNavigator.tsx CRLF as committed).
- Server integration suite on a fresh scratch database (`scratch_itest_1792401645`, scratch cluster on 55471, migrations 001–006 applied): `npm run test -w @sora/server` → 302/302, 0 skipped; `npm run db:test` → 001–004 PASS. Closed.
- Still open: nothing exercised on a device; crossfade needs `npm run dev:mobile:build`.

## Regression: theme frozen after the first switch (reported on device)

- Cause: in a build without view-shot's native module, `require('react-native-view-shot')` does not throw to the caller. Metro reports the module's `TurboModuleRegistry.getEnforcing` failure as a fatal error and the require yields `undefined`. `loadViewShot` cached that, `shot.captureRef` then threw after `queued` was set, and every later switch was queued forever.
- Fix (`mobile/src/app/providers/ThemeProvider.tsx`):
  - `loadViewShot` checks `TurboModuleRegistry.get('RNViewShot')` / `NativeModules.RNViewShot` before importing, and treats an empty require as absent.
  - A capture that throws, rejects, fails to load (`onError`) or takes longer than `SNAPSHOT_TIMEOUT_MS` (800) applies the queued switches at once (`abandon`); the timeout is scoped to its attempt.
  - The reveal has a `REVEAL_TIMEOUT_MS` fallback, and clearing is scoped to its own snapshot.
- Verified: `npx tsc --noEmit -p mobile` exit 0; mobile 803/803. Not exercised on a device; the hook has no unit test (no React renderer in the node test setup).

## Change of approach: theme crossfade replaced by a left-to-right sweep (user request)

- The user judged the snapshot crossfade worse on device (SM-S948B, dev build with view-shot, installed 16:54). Replaced by `useThemeSweep` (`mobile/src/app/providers/ThemeProvider.tsx`): a band in the new background slides in from the left (180 ms, ease-in-out, UI thread), the queued switches apply once it covers, and it slides out to the right after their render commits; per-sweep safety timeout (`SWEEP_TIMEOUT_MS`). No snapshot, so `react-native-view-shot` was uninstalled (`npm uninstall -w @sora/mobile`; `mobile/package.json` and `package-lock.json` back to HEAD). RUNBOOK's native-package section kept, made generic.
- Bottom tab bar: the `primaryMuted` pill behind the active icon removed (`MainTabNavigator.tsx`), on request; DESIGN_GUIDELINES updated.
- Verified: `npm run typecheck` exit 0; mobile 803/803. Not yet seen on the device.
