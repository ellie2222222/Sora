# Comment audit of this session's changed files — no comment edits needed, two code-level gaps flagged

**Date:** 2026-09-03T15:05:00Z
**Method:** comment-audit skill
**Verdict:** PASS
**Scope:** The nine files changed this session, named by the user:
`server/src/{app.module.ts, main.ts, common/all-exceptions.filter.ts, wallets/invitations.controller.ts,
wallets/invitations.service.ts, wallets/wallets.module.ts}`,
`packages/contracts/src/{schemas.ts, responses.ts}`, `mobile/src/services/api/invitations.ts`.
Comment-only pass — no logic changed.
**Files touched:** none (read-only outcome; the one stale comment in scope was already removed earlier
today, see Finding 1)
**Related reports:** [2026-09-03-route-wiring-double-check.md](2026-09-03-route-wiring-double-check.md),
[2026-09-03-infra-audit.md](2026-09-03-infra-audit.md). No prior comment-audit report exists in
`verifications/`, so nothing was carried forward.

**Governing policy:** CLAUDE.md Part 7 rule 11 (comments explain *why*, never *what*; 1-2 lines;
`TODO`/`FIXME` must point at something concrete; never a debug journal), read fresh this run. Applied in
place of the skill's generic default, which it subsumes.

## Findings

### 1. Patterns 1, 2, 5, 6, 7, 8 — no instances in scope

Checked every comment in all nine files:

- **Restates-the-code (1):** none. Each comment states a reason not visible in the code — why the
  cross-cutting concerns are DI providers rather than `useGlobal*()` (`app.module.ts`), why CORS is
  unrestricted (`main.ts`), why framework statuses are mapped explicitly instead of searched for in
  `ERROR_STATUS` (`all-exceptions.filter.ts:23-28`), why `AuthModule` is safe to import
  (`wallets.module.ts`), why `invitedEmail` is masked (`invitations.service.ts:193`), why the email
  equality check exists (`:212`).
- **Commented-out dead code (2):** none.
- **Untracked `TODO`/`FIXME` (5):** none — zero `TODO`/`FIXME`/`XXX`/`HACK` in scope. (Consistent with
  the repo-wide inventory earlier today, which found exactly one comment directive in all of
  `server/`, `mobile/`, `packages/`, `db/`, `scripts/`, and it was a legitimate `eslint-disable` for
  React Navigation's global type augmentation.)
- **Condensable blocks (6):** none. The three multi-line blocks in scope
  (`app.module.ts`'s DI-ordering note, `wallets.module.ts`'s import note,
  `invitations.controller.ts`'s placement note) each carry two distinct non-obvious facts, not prose
  padding. Multi-line class/file-level rationale is this repo's established style.
- **Rotting magic-count claims (7):** none — no comment in scope cites a call-site count.
- **Animation/visual narration (8):** not applicable; no UI code in scope.

One stale comment (pattern 4) *did* exist in scope at the start of the session —
`mobile/src/services/api/invitations.ts`'s "The preview body (API spec §8.4) has no type in
@sora/contracts" — but it was made false and deleted a few minutes earlier by the double-check pass
that moved the type into the contract. Recorded here so a later run doesn't look for it.

### 2. Missing comments — one gap considered, correctly left empty

The only new code this session that could plausibly owe a comment is the four added module imports
in `app.module.ts`. Deliberately left uncommented: a note there would have to say *why these were
missing*, which is exactly the debug-journal shape CLAUDE.md rule 11 forbids inside code. That
history belongs in the commit message and in
[2026-09-03-infra-audit.md](2026-09-03-infra-audit.md), where it now lives.

No other gap found. The rest of the changed code is a plain module list, a one-line Nest bootstrap
call, two thin controller delegations, and two interface declarations — all self-evident.

## Flagged, not fixed

### 3. FLAG (code change, out of this skill's scope) — the 401/403 log omits `role`, which three documents require

`all-exceptions.filter.ts:53` logs `${code} actor=${actor} target=${target}`. Spec §16.1 (verified,
line 1066: "Every `401` and `403` is logged at `WARN` with actor, **role** and target"), CLAUDE.md
LA-03 (line 558, same three fields) and AC-05 all require the resolved role as well.

The comment above it (`:48-49`) is **not** stale — it says "with actor and target", accurately
describing what the code does. The code is what diverges from the spec. Fixing it means reading the
resolved wallet role off the request (the guard already stashes one at `WALLET_ACCESS_KEY`, per the
infra audit's Finding 7), which is a logic change this skill may not make.

### 4. FLAG (fragile cross-file references, all currently valid)

Seven comments in scope cite API-specification section numbers. Every one was verified to resolve
*and* to say what the comment claims: §16.1 (`all-exceptions.filter.ts:48`), §8.1
(`invitations.service.ts:54`), §8.4 (`:193`, `schemas.ts:158`, `responses.ts:232`), §8.5
(`:212`, `schemas.ts:158`), §10.4 (`responses.ts:277`). Left as-is — they are genuine external
references, the category the skill says to keep. Flagged because nothing mechanically keeps them in
sync: renumbering a spec section silently orphans all of them, and
`node scripts/check-contract-parity.mjs` checks routes and enums against the spec, not section
citations.

### 5. FLAG (same drift class as what was fixed today, one file out of scope)

`mobile/src/services/api/members.ts:11-15` says `transferOwnershipSchema` "has no schema in
@sora/contracts … it belongs in the contracts package". Verified still true: it is declared locally
at `server/src/wallets/wallets.controller.ts:71`, and that controller's own comment (`:53`) makes the
same admission. So both comments are accurate, and the *code* carries the duplication — the identical
situation just resolved for the invitation preview type. Not fixed here: out of the named scope, and
the fix is a contract change, not a comment edit.

## Fixes Applied

None needed. No comment in scope violated the policy.

## Follow-ups

- Add `role` to the 401/403 WARN line (Finding 3) — an AC-05/LA-03 compliance gap, cheap once the
  guard's stashed access is reused.
- Move `transferOwnershipSchema` into `@sora/contracts` and drop both local copies plus the two
  comments admitting the gap (Finding 5).
- The §-reference fragility (Finding 4) has no cheap mechanical guard; noted rather than proposed.
