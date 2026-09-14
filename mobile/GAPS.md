# Known gaps

Honest record of what is stubbed, deferred, or unverified — check here before
assuming a surface is finished.

## Resolved since this file was last updated

- **i18n coverage outside nav/auth/settings/home** — done. Every screen now
  calls `t(`; the 10-locale expansion (2026-09-13) covers the whole app, not
  just nav/auth/settings/home.
- **Category edit/archive UI** — done. `CategoryListScreen` now uses
  `useUpdateCategoryMutation`/`useArchiveCategoryMutation`.

## Not built

- **Google sign-in is unverified.** `useGoogleSignIn` (implicit `id_token`
  flow via `expo-auth-session`) and `POST /auth/google` (verified server-side
  against Google's signing keys via `google-auth-library`) both exist and
  typecheck, and the button hides itself when no client id is configured
  (`env.googleClientIdWeb/Ios/Android`, all unset by default). Exercising it
  needs a real Google Cloud OAuth client, which does not exist in this
  environment — nothing about the actual OAuth round-trip has been run.
- **Editing a member's `relationLabel` after invitation.** `updateMemberSchema`
  (`@sora/contracts`) only carries `role`; there is no endpoint to change the
  label once a member is active. Would need a contract/API change, not just a
  screen — the mobile Member Actions sheet (`WalletMembersScreen`) only offers
  what the existing endpoint supports (role change, ownership transfer,
  removal).
- **Push notifications / background refresh.** Not attempted — no such
  requirement in the plan.

## Verified, but not on a device

There is no Android SDK, Xcode, or emulator in this environment, so nothing
here has been seen rendering:

- `npx tsc --noEmit` — clean, zero errors, across the whole `src/` tree
  (re-checked after the theme/i18n/Google-auth/Settings pass).
- `node --test src/**/*.test.ts` — 47/47 passing (11 session-manager tests,
  36 transaction-form tests). Both real bugs the tests caught were fixed
  before this was written — see below.
- `npx expo export --platform web` — succeeds, 2,604 modules (was 2,522
  before this pass — i18next/react-i18next/expo-auth-session/expo-localization
  /AsyncStorage all resolve), ~3.3MB bundle. Proves every import across the
  monorepo boundary resolves and the app would start; it does not prove any
  screen renders correctly, since layout and touch behavior differ on native.
- The 5-theme system was checked by reading `design-system/colors.ts`'s
  output for each theme, not by seeing it rendered — no device/emulator to
  screenshot against. Contrast (text on background, onPrimary on primary) was
  chosen by eye against the hex values, not measured against WCAG ratios.

## Bugs found by the tests, fixed in this pass

1. **`switchType()` in `utils/transactionForm.ts`** read the same side
   (`fromAccountId ?? toAccountId`) for both EXPENSE and INCOME when carrying
   an account across a type switch. Switching a `TRANSFER(A→B)` draft to
   INCOME silently kept **A** (the source) instead of **B** (the
   destination) — both are valid UUIDs, so nothing downstream would have
   caught it. Test: `switchType > keeps the DESTINATION when a transfer
   becomes income`.
2. **`SessionManager.refreshTokens()` in `services/auth/session.ts`** cleared
   its single-flight latch from a side-chain (`attempt.catch().finally()`)
   rather than from the chain the caller actually awaits. The latch cleared
   one or two microtasks after the awaited promise resolved, so a caller that
   awaited a refresh and immediately triggered another could start a second
   refresh before the first had released — which the API's refresh-token
   rotation would answer by revoking the entire token family. Test:
   `refreshTokens > releases the latch so a later 401 can refresh again`.

## Design calls made without asking

- **Cross-wallet transfer detection** reads the wallet id the account picker
  returned when the "to" account was chosen, rather than re-deriving it from
  the account id afterward (`AddTransactionScreen`'s `toAccountWalletId`
  state). Simpler and avoids a second lookup, at the cost of the warning
  banner not reappearing if the picker is reopened without changing the
  selection — acceptable, since the warning's job is to inform the choice,
  not to persist as a state.
- **Wallet switcher default**: on load, the user's own wallet wins over any
  shared wallet (`WalletProvider`), since it's the one every account has and
  the one most sessions start from. Not specified in the plan.
- **Default theme is fixed to Obsidian regardless of device light/dark
  setting** — the product brief calls for one specific default rather than
  following the system, which is why `ThemeProvider` no longer has the
  previous dark/light-follows-device fallback it had before this pass.
- **Semantic financial colors (income/expense/transfer/warning/danger) are
  the literal same hex in all five themes**; only their `*Muted` chip
  backgrounds vary, and only by two sets (dark, for Obsidian; light, shared
  by the other four) rather than one per theme — a muted pill only needs to
  read legibly on its own surface, not carry a theme's personality.
- **Theme/locale hydrate-once-from-server**: on sign-in, a locally cached
  choice (e.g. from a previous session on a shared device) is overwritten by
  the signed-in user's server-stored `theme`/`locale` exactly once; every
  change after that point is trusted from this device and pushed to the
  server best-effort (a failed sync doesn't block switching locally). Neither
  the API spec nor the design brief specified this precedence — "the server
  wins for a returning user, this device wins once it has spoken" was my call.
- **Google sign-in's `nonce` is `Math.random()`-based, not
  `expo-crypto`-random** — it only needs to be unique per attempt (replay
  hygiene), the same reasoning `client.ts`'s `Idempotency-Key` already uses,
  and doing it synchronously avoided an async crypto call inside a hook whose
  request config has to build synchronously. The backend does not check the
  returned token's nonce claim against what was sent (`google-auth-library`
  verifies signature/audience/expiry, not app-supplied nonce matching), so
  this is defense-in-depth on the client side only, not a verified round-trip.
