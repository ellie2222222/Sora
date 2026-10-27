# Invitation links reach the accept screen; app-wide type scale raised one step

**Date:** 2026-10-23
**Method:** ad hoc
**Verdict:** PASS (types, tests, Android bundle); neither change was checked on a device
**Scope:**
1. A follow-up from 2026-10-23-invitations-inbox.md: `AcceptInvitationScreen` could not be reached. Creating an invitation threw away its one-time token and toasted "Invitation sent", although nothing is sent (spec §8.2).
2. A user request to make text bigger across the whole app, not only the title-size figures on goal cards.

**Files touched:**
- **Mobile — invitation links:**
  - new `features/auth/invitationLink.ts` and `usePendingInvitation.ts`; `AcceptInvitationScreen.tsx`, `features/auth/index.ts`;
  - `app/navigation/{types,AppNavigator,RootNavigator,MainTabNavigator}.ts(x)`;
  - `features/wallets/components/InviteMemberPanel.tsx`.
- **Mobile — type scale:** `design-system/typography.ts`, `design-system/sizes.ts` (`skeletonLine`), `mobile/tailwind.config.js`.
- **Locales:** all 10.
- **Docs:** `docs/API_SPECIFICATION.md` §8.2, `docs/DESIGN_GUIDELINES.md` ("Type size and tone", "Spacing and density").

**Related reports:** 2026-10-23-invitations-inbox.md, 2026-10-23-ui-guidelines-audit.md

## Method

- `npm run typecheck -w @sora/mobile`
- `npm run test -w @sora/mobile` (includes `tokens-usage.test.ts`, which checks the Tailwind mirror, and `readable-text.test.ts`)
- the literal `t()` key scan against `en.ts`
- `npx expo export --platform android` to the scratchpad, to prove Metro resolves the new imports between the auth feature and navigation

## Findings

- **Inviter:**
  - after "Create invite link", the panel shows the link (`Linking.createURL('invite', { token })`, i.e. `sora://invite?token=…` in a build) with Share (React Native `Share`, no new dependency) and Done;
  - the misleading "Invitation sent" toast and its key are gone.
- **Deep link:**
  - `NavigationContainer.linking` maps `invite` to `AcceptInvitation`, which now exists in both the auth stack and the app stack;
  - leaving a cold-opened link resets to Login or Main.
- **Signed out:**
  - Sign in or Register remembers the token (in memory);
  - `usePendingInvitation` in `MainTabNavigator` reopens the screen once the app stack mounts;
  - a guest is sent to sign-in the same way.
- **Signed in:** Accept toasts "Joined {wallet}" and returns home.
- **Type scale:**
  - `fontSize` xs 11→12, sm 13→14, md 15→16, lg 17→18, xl 20→22, xxl 26→28, display 34→36, hero 42→44;
  - `lineHeight` sm 18→20, md 20→22, lg 22→24;
  - `skeletonLine` raised to match;
  - every `Text` variant, `Money` and hitSlop derived from a line height moves with it;
  - the tab bar content is about 50pt inside its fixed 56pt.
- **Evidence:**
  - typecheck: clean;
  - mobile: 816 tests, 816 pass;
  - key scan: all literal keys exist;
  - expo export: an Android bundle of 8MB was written.

- **Donut (user request "make 3 stand out, group the rest into Others"):**
  - `groupDonutSlices` (`utils/donutCallouts.ts`, 2 new tests) keeps the three largest slices and sums the rest;
  - `DonutChart` draws and labels those plus an "Others" arc in `borderStrong`. A single leftover keeps its own name;
  - the "Charts answer a question" table in DESIGN_GUIDELINES says so;
  - after this change: mobile 818 pass, locale parity and plurals 13 pass, key scan clean.

## Fixes Applied

As above. No separate defect fixes.

## Follow-ups

- **Not checked on a device:**
  - the deep link: open `sora://invite?token=…` signed out, signed in and as a guest;
  - the larger type at phone width in the longest locale (de, ru) in both themes. DESIGN_GUIDELINES requires this for a type-token change.
- **Fixed-height containers that may clip at the new size:** `AccountCard` (fixed aspect ratio) and the tab bar (`tabBar.height`), already listed in the UI audit.
- **Email verification for password accounts:** still not built; needs a decision on sending mail (see the chat).
