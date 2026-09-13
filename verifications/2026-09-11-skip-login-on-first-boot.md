# First cold start skips Login, drops straight into guest mode

**Date:** 2026-09-11T00:00:00Z
**Method:** ad hoc
**Verdict:** PASS
**Scope:** `mobile/src/app/providers/AuthProvider.tsx`'s session-restore effect and
`mobile/src/services/storage/preferencesStore.ts` — a new `HAS_LAUNCHED_STORAGE_KEY` distinguishes
"never opened this app before" from "explicitly signed out / left guest mode," since the existing
`GUEST_MODE_STORAGE_KEY` alone can't tell those apart (both read as absent).
**Files touched:** `mobile/src/app/providers/AuthProvider.tsx`,
`mobile/src/services/storage/preferencesStore.ts`
**Related reports:** none — first pass on this behavior.

## Method

Traced the boot path by reading code (no device/simulator available in this session):
`RootNavigator.tsx` → `pendingGuestUpload ? Upload : isAuthenticated || isGuest ? App : Auth`, and
`AuthProvider`'s mount effect, which is the only place `isGuest`/`isAuthenticated` are seeded before
that render decision. Reasoned through the three relevant cold-start cases by hand (below) rather
than running the app, since this session has no Expo device attached.

```
npm run typecheck -w @sora/mobile   # clean
npm test -w @sora/mobile            # 120/120 — no test exercises this component (no RN component
                                     # test runner exists in this repo; confirmed via mobile/GAPS.md)
```

## Findings

1. **Root cause confirmed**: `isGuest` defaulted to `false` until a user explicitly tapped
   "Continue without an account" on `LoginScreen`. A brand-new install has no stored session and no
   guest flag, so `RootNavigator` fell through to `AuthNavigator` → `LoginScreen` on the very first
   open — exactly what was reported.
2. **`GUEST_MODE_STORAGE_KEY` alone can't distinguish "never chosen" from "explicitly left guest
   mode"**: `exitGuestModeToAuth()` (Settings → guest banner → "Create an account or sign in") calls
   `preferencesStore.remove(GUEST_MODE_STORAGE_KEY)`, which reads back identically to a key that was
   never set. Auto-entering guest mode whenever the flag is merely absent would have silently undone
   that deliberate exit on the next cold start. Added a separate `HAS_LAUNCHED_STORAGE_KEY`
   (`AuthProvider.tsx:90`) so only a *true* first launch (`restored === null && guestFlag !== 'true'
   && hasLaunched !== 'true'`) triggers the auto-guest path; it's set unconditionally right after,
   so it can only fire once per install.
3. **Traced all three cold-start cases by hand**:
   - Fresh install, never opened → `isFirstLaunch` true → seeds a guest wallet (`ensureSeeded()`,
     same starter data a real registration gets) and sets `isGuest = true` → lands on `AppNavigator`.
   - Re-open after a deliberate logout or "sign up or in" exit → `hasLaunched` already `'true'` from
     the first launch → `isFirstLaunch` false → `Login` shows, unchanged from before this change.
   - Re-open with a valid stored session → `restored !== null` → `isFirstLaunch` false regardless of
     the other flags (guarded first in the condition) → normal authenticated boot, unchanged.
4. **`guestHasData` doesn't need special-casing for the just-seeded wallet**: `ensureSeeded()` writes
   through `guestStore.mutate`, and the effect's `guestStore.subscribe` listener (already active
   before the async seed runs) picks up that write on its own — confirmed by reading
   `guestSeed.ts:21-24`. An earlier draft of this fix tried to thread `isFirstLaunch` into
   `setGuestHasData` directly; removed once this was confirmed redundant.

## Fixes Applied

None beyond the change itself — described in Findings above. `preferencesStore.ts:26-27` adds the
new key; `AuthProvider.tsx:78-97` adds the first-launch branch.

## Follow-ups

- **Not verified on a device.** No Expo simulator/device was available in this session; the trace
  above is a careful read of the actual boot logic, not an observed run. Worth an actual cold-start
  check (clear app data, launch, confirm no Login flash) before shipping.
- **Deep-linked invitation on a true first launch is unhandled.** If a brand-new install is opened
  via an email-invitation link (`AcceptInvitation`, which only lives on the unauthenticated
  `AuthNavigator` stack), this change would drop the user into guest mode instead of the invitation
  screen. No `Linking`/deep-link config was found wired into `RootNavigator`'s `NavigationContainer`
  in this codebase, so this may not be a live path today — flagged rather than fixed, since resolving
  it needs knowing whether/how deep links are actually handled elsewhere first.
