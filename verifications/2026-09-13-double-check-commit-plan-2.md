# Double-check: commit plan refreshed again — server/src finished the enum-value migration, derive.ts deleted

**Date:** 2026-09-13T18:23:21Z
**Method:** double-check skill, scoped to the user-named target (`/commit-messages`) — a second refresh
of the same commit plan, 23 minutes after the first (see
[2026-09-13-double-check-commit-plan.md](2026-09-13-double-check-commit-plan.md))
**Verdict:** PASS (plan refreshed again; no regression; both open follow-ups from the prior pass resolved)
**Scope:** Full working tree (158 changed/untracked entries, up from 143 twenty-three minutes earlier).
**Files touched:** none — verification pass only.
**Related reports:** [2026-09-13-double-check-commit-plan.md](2026-09-13-double-check-commit-plan.md)
(the pass immediately prior — both of that report's open follow-ups are addressed here, see Findings),
[2026-09-12-infra-audit.md](2026-09-12-infra-audit.md), [2026-09-12-double-check-mobile-redesign.md](2026-09-12-double-check-mobile-redesign.md)

## Method

Re-ran `git status --short`, diffed against the previous pass's known file set to isolate what changed
in the intervening 23 minutes, read the actual diffs (not filenames) for every newly-touched file, then
re-ran the full verification suite.

## Findings

### 1. Both of the prior pass's open follow-ups were resolved in the intervening 23 minutes

- **Finding 3 from the prior report** ("mobile/contracts adopted `TransactionType.X`-style enum values,
  `server/src` hadn't") — now resolved. `server/src/{accounts,budgets,categories,dashboard,transactions}`'s
  services, `goals/{goal-access,goal-contributions,goals}.{ts,service.ts}`,
  `wallets/{invitations,members,wallet-access,wallets}.service.ts` (11 files) all now use the enum-value
  form. Re-grepped the exact literal-comparison patterns the prior report cited
  (`=== 'INCOME'`, `!== 'ARCHIVED'`, etc.) — **zero hits left in `server/src`**.
- **Finding 4 from the prior report** ("`mobile/src/utils/derive.ts` is fully dead code, kept in sync
  with the refactor instead of deleted") — now resolved: the file is deleted (`D` in `git status`).
  Re-confirmed no dangling import: `grep -rn "utils/derive" mobile/src` — zero hits, consistent with it
  having had zero importers before deletion too.

### 2. New file in scope: `packages/contracts/test/calc.test.ts`

28 insertions / 27 deletions — a near-total rewrite of the test file's literal comparisons to the new
enum-value form, consistent with `calc.ts` itself having migrated in the prior pass. Same mechanical
migration, not new logic.

### 3. Verification — no regression from this additional round of changes

```
npm run build -w @sora/contracts        # clean
npm run typecheck -w @sora/server       # clean
npm run typecheck -w @sora/mobile       # clean
npm test -w @sora/contracts             # 63/63 pass
node scripts/check-contract-parity.mjs  # 31/31 PASS
npm test -w @sora/server                # 3/3 pass
```

## Revised commit plan

Same structure as the prior two passes; **Group 1** widens once more to cover the now-complete
server-side migration, and `derive.ts` moves from "touched" to "deleted."

**1. Contracts — add locale list, pagination constants and runtime enum-value objects; migrate the
whole stack (contracts, mobile derivation/guest/form logic, every server service) off string-literal
comparisons; delete the now-fully-migrated-but-still-dead `derive.ts`; fix comma-formatted amount
validation**
`packages/contracts/src/{enums,money,schemas,calc}.ts`, `packages/contracts/test/{money,calc}.test.ts`,
`mobile/src/utils/{money,transactionForm}.ts` (`derive.ts` **deleted**, not modified), all ten
`mobile/src/services/guest/*.ts` files, `server/src/{accounts,budgets,categories,dashboard,transactions}`'s
service files, `server/src/goals/{goal-access,goal-contributions,goals}.{service.}ts`,
`server/src/wallets/{invitations,members,wallet-access,wallets}.service.ts`,
`server/src/{goals,wallets}.controller.ts`

**2-10.** Unchanged from the 2026-09-13T17:59Z draft.

## Fixes Applied

None — verification pass only.

## Follow-ups

Both follow-ups from the immediately prior report are now closed (Finding 1 above). Everything else
carried forward unchanged: root scratch docs (`HANDOFF.md`, `REDUX_RTK_QUERY_MIGRATION_PLAN.md`,
`ui-design-rules-of-thumb.md`, `DESIGN_RULES.md`), `mobile/src/check_hardcoded.js`, CLAUDE.md's stale
MB-02, `server/src/verify-boot.ts` not yet deleted.
