# Wallet Member Actions sheet (mobile)

**Date:** 2026-08-30T00:00:00Z
**Method:** ad hoc (scoped fix, no broad Phase 1 sweep — one new shared component plus one screen rewire)
**Verdict:** PASS
**Scope:** Tier 2 UX item chosen by the user after a scoping pass showed the other two proposed Tier 2
items (Add Transaction split by type, Settings hub split) weren't warranted yet. Consolidates
`WalletMembersScreen`'s two inline per-row actions (Make owner, Remove) into a single "..." trigger
opening a new generic `ActionSheet`, and adds a previously-unwired Change Role action
(`useUpdateMemberRole`, exported from `useWalletMembers.ts` but called by nothing until now).
**Files touched:** `mobile/src/components/ActionSheet.tsx` (new), `mobile/src/components/index.ts`,
`mobile/src/features/wallets/screens/WalletMembersScreen.tsx`, `mobile/GAPS.md`
**Related reports:** [2026-08-30-wallet-context-and-admin-actions-mobile.md](2026-08-30-wallet-context-and-admin-actions-mobile.md)
(Tier 1, same day, same wallet-admin area)

## Method

- Scoped Tier 2 with a background Explore pass against the live code before building anything — it
  found the "Edit Relation Label" action originally proposed for this sheet has no backing endpoint:
  `updateMemberSchema` in `packages/contracts/src/schemas.ts` only accepts `role`, no `relationLabel`.
  Not added; recorded in `mobile/GAPS.md` instead of building unreachable UI.
- A second background check against `server/src/wallets/members.service.ts` and
  `docs/API_SPECIFICATION.md` §7.2 confirmed the update-role endpoint's real constraints before wiring
  the picker: only `EDITOR`/`VIEWER` are valid targets; `role: 'OWNER'` is rejected at the service layer
  (`422`), and demoting the sole owner is rejected separately (`409 WALLET_LAST_OWNER`). The UI mirrors
  this by only ever offering "Set as Editor"/"Set as Viewer", and only for rows already excluded from
  being the wallet's `OWNER` (same gate the old inline actions used).
- `npx tsc --noEmit` — clean.
- `npx expo export --platform web` — succeeds, 2609 modules (was 2608 before this pass — the one new
  `ActionSheet.tsx`).
- `npx tsx --test src/services/auth/session.test.ts src/utils/transactionForm.test.ts` — 36/36, unaffected
  (this change has no pure-logic units to cover; it's UI wiring over an already-tested mutation hook).
- Manual re-read of `ActionSheet.tsx` and the full rewritten `WalletMembersScreen.tsx` for the "review
  your own diff" convention.

## Findings

1. **Contract mismatch avoided.** The scoping pass's proposal to add relation-label editing would have
   built UI with no endpoint behind it. Caught before writing any code; documented as a real, separate
   backend gap in `mobile/GAPS.md` rather than silently dropped.
2. **Role-change safety mirrors the server exactly.** `WalletRole` values offered are `EDITOR`/`VIEWER`
   only; `OWNER` is never offered as a role-change target (ownership only moves through the existing
   "Make owner" → `useTransferOwnership` path). The action-sheet trigger itself is hidden for the `OWNER`
   row and for the acting user's own row, matching the pre-existing `canPromote` gate this replaces.
3. **No client-side check treated as the authorization boundary.** Every action still routes through its
   real mutation (`useUpdateMemberRole`, `useTransferOwnership`, `useRemoveMember`); the sheet only
   decides which options to *show*, consistent with `roles.ts`'s documented "courtesy, not a boundary"
   caveat.
4. **`ActionSheet` is generic, not member-specific.** Takes a plain `actions: ActionSheetAction[]` array
   and an optional `title`; nothing in it references wallets or members, so it's reusable for the next
   place this repo needs a bottom-sheet action list rather than a one-off.
5. **Destructive-confirmation pattern unchanged.** "Remove from wallet" keeps the pre-existing
   no-extra-confirm behavior (membership removal sets `status = REVOKED`, not a hard delete — BR-01/-08
   reversible); "Make owner" still routes through the existing `ConfirmDialog`, since transferring
   ownership is the higher-consequence action. Not introducing a second confirmation mechanism.
6. **Money/testID/logging conventions** — no money values touched; new testIDs
   (`wallet-member-actions-{id}`, `action-sheet-cancel`) follow the same ad hoc scheme already used
   throughout this file (see Tier 1's report, Finding 6 — pre-existing drift from documented NC-04, not
   worsened by this pass).

## Fixes Applied

N/A — no defects found requiring a fix; the contract-mismatch check in Finding 1 changed the *plan*
before any code was written, not code after the fact.

## Follow-ups

- Relation-label editing after invitation acceptance remains unbuilt — needs a contract/API change
  (`updateMemberSchema` extended, or a new endpoint), not a mobile-only fix. Logged in `mobile/GAPS.md`.
- Not tested on a device/emulator — none available in this environment (standing limitation, see Tier 1's
  report and `mobile/GAPS.md`).
