# Double-check and comment audit of today's session changes

**Date:** 2026-10-23T09:32:18Z
**Method:** double-check skill, with the comment-audit skill
**Verdict:** PASS (types, tests, parity, key scan). The UI changes were not driven on a device.
**Scope:** The 134 files modified today (seed cards, accounts layout, donut callouts, UI audit, invitations inbox, invite links, type scale), listed from `git status` into the scratchpad. Docs and test plans that those changes touch were included.
**Files touched:**
- **Docs:**
  - `docs/test-plans/{wallets,auth,README}.md`
  - `docs/API_SPECIFICATION.md` §5.6
  - `SDS.md`
  - `plans/tooling/seed-data-plan.md`
- **Mobile, utils and forms:**
  - `mobile/src/utils/{errors,errors.test}.ts`
  - `features/wallets/components/InviteMemberPanel.tsx`
  - `features/categories/components/{AddCategoryModal,CategoryManageDialog}.tsx`
  - `features/planning/components/GoalCard.tsx`
  - `features/dashboard/components/{BudgetGoalSummary,CategoryBreakdown}.tsx`
- **Mobile, auth:**
  - `features/auth/{invitationLink,rememberedInvitation,rememberedInvitation.test}.ts`
  - `usePendingInvitation.ts`
  - `screens/AcceptInvitationScreen.tsx`
- **Locales:** all 10.
- **Comment-only edits from the comment audit:**
  - `server/src/wallets/invitations.{controller,service}.ts`
  - `mobile/src/features/auth/invitationLink.ts`
  - `mobile/src/features/accounts/components/AccountCarousel.tsx`

**Related reports:** 2026-10-23-ui-guidelines-audit.md, 2026-10-23-invitations-inbox.md, 2026-10-23-invite-links-and-type-scale.md

## Method

- Health sweep by a read-only agent over the scope; each finding below was re-checked against the live file before it was fixed.
- Comment audit by an agent, limited to comment-only edits.
- Checks:
  - `npm run typecheck`
  - `npm run test -w @sora/mobile`
  - `npm run test -w @sora/contracts`
  - `node scripts/check-contract-parity.mjs`
  - the literal `t()` key scan (`check-keys.mts`, run with the mobile root)
  - `node --test src/features/auth/rememberedInvitation.test.ts`

## Findings

1. **Test-plan anchors moved by today's test inserts.**
   - Checked with `grep -n` on the test files.
   - TC-WAL-14 pointed at members `:168`, but the inbox `describe` now sits there and the test is at `:300`.
   - TC-AUTH-19/20/30 pointed at session `:239/:267/:275/:254`; the tests are at `240/271/279/258`.
   - Verdict: FAIL, fixed.
2. **Untranslated validation at today's call sites.**
   - `InviteMemberPanel`, `AddCategoryModal` and `CategoryManageDialog` passed the contracts' English Zod messages through `issueMessagesByPath`.
   - Switching all 12 callers wholesale is wrong: the budget, transaction and card refinements carry `custom` messages with no `i18nKey`, which would collapse to "Invalid".
   - Fix: `issueMessagesByPath` takes an optional `messageFor`, and only these three string/email forms pass `fieldErrorMessage`.
   - Verdict: FAIL, fixed.
3. **SDS stale on the inbox.**
   - §6.1 said 58 routes; the spec index has 61.
   - The routes table, controller table, Auth/Settings screen rows, wallet-sheet prose and WAL-US mapping had no inbox and no deep link.
   - Verdict: FAIL, fixed.
4. **`INVITATION_DECLINED` has no Activity label.** The server writes it (`audit-events.ts`), but `activity.events` lacked it in all 10 catalogs, so the panel showed `humanizeCode` English. Verdict: FAIL, fixed.
5. **Invite copy hard-coded "7 days".**
   - `INVITATION_TTL_DAYS` is configurable, so the text can be wrong.
   - The copy now interpolates `created.expiresAt` through `formatDay(dayOfDate(...))`, like `members.expires`.
   - Verdict: FAIL, fixed.
6. **Spec §5.6 silent on `email_verified_at`.**
   - TC-WAL-47 cites §5.6, and `auth.service.ts:259-297` sets the field in three paths: create, link, and a returning sign-in whose email still matches.
   - Verdict: FAIL, fixed.
7. **Three identical percent keys, plus hard-coded `}%`.**
   - Removed `goals.progressPercent`; `GoalCard` uses `common.percent`, as do `BudgetGoalSummary:96` and `CategoryBreakdown:98,115,195`.
   - es `common.percent` now uses the same spaced form the dropped key had.
   - `guest.upload.percent` predates today and was left alone.
   - Verdict: FAIL, fixed.
8. **No mobile test for the invite-link handoff.**
   - `invitationLink.ts` imports `expo-linking`, which node's test runner cannot load (`ERR_UNSUPPORTED_NODE_MODULES_TYPE_STRIPPING`).
   - Fix: moved the remember/take functions to `rememberedInvitation.ts` and added 2 tests (single use; the latest link wins).
   - Test plan: TC-WAL-48 is Partial (unit only). TC-WAL-49, the Settings inbox UI, is a Gap.
   - Verdict: FAIL, fixed in part.
9. **Test-plan index stale.**
   - The wallets row said 40 and WAL-US-01..13; there are 49 cases now.
   - Accounts had 25 cases, not 21. Offline sync had 33, not 27.
   - Totals are now 318 / 312 / 4 / 2, re-summed from the rows.
   - Verdict: FAIL, fixed.
10. **Seed plan wording.** It claimed cards "across every wallet", but `house` has cash only. Reworded. Verdict: FAIL, fixed.
11. **Checked clean by the sweep:**
    - contracts, server and spec agree on `ReceivedInvitationResponse`, the routes and `INVITATION_EMAIL_UNVERIFIED`;
    - inbox pagination and the 404-for-others rule;
    - TC-WAL-41..47 anchors;
    - rule 14: the `@/app/navigation` imports in auth are type-only;
    - rules 1, 15, 18 and 19: no new violations;
    - the deep-link prefixes match `app.json`;
    - the type-scale mirror;
    - the RTK slice pattern;
    - the seed typecheck.
12. **Comment audit.**
    - Six comment-only edits in 4 files: the `InvitationsController` class doc rewritten, `invitations.service.ts:294-297` and `invitationLink.ts:12-15` condensed, and the `AccountCarousel` visual narration trimmed.
    - Flagged and left alone (see Follow-ups).

## Fixes Applied

Each fix is listed in Findings. They were re-checked by re-running the full set:
- typecheck: exit 0;
- mobile: 821/821 pass (818 earlier, plus 2 handoff tests and 1 `messageFor` test);
- contracts: 184/184;
- parity: 149/149;
- key scan: all literal `t()` keys exist;
- `grep` confirms each new anchor lands on its `it(` line.

## Follow-ups

- **Flagged by the comment audit, not changed:**
  - `ToastProvider` cites CLAUDE.md rule 14 by number;
  - `AddBudgetModal` points to `TransactionFormModal`, which in turn points elsewhere;
  - the barrel-cycle explanation is copied in `TransactionFormModal`, `AddContributionModal` and `AddBudgetModal`;
  - `sora://invite` is spelled out in two files.
  Each needs a code-side home, not a comment edit.
- **Other forms still show English:** budget, goal, wallet and account forms show the contracts' English Zod text. Their `custom` refinements need `params.i18nKey` in `@sora/contracts` before `fieldErrorMessage` can word them.
- **Device checks still pending:**
  - the deep link signed out, signed in and as a guest;
  - the Settings inbox (TC-WAL-49);
  - the larger type in de and ru;
  - the donut Others arc.
- **Carried forward:**
  - email verification for password accounts (needs a mail provider);
  - 4 orphan users from the failed seed run `61b401e4` on sora_dev, which need approval before deletion;
  - `AccountCard` and tab-bar clipping at the new type size.
