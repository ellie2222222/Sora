# Double-check of the route test, role logging and status-enum work — six findings, all fixed

**Date:** 2026-09-03T15:40:00Z
**Method:** double-check skill
**Verdict:** PASS
**Scope:** This session's uncommitted work: `server/test/routes.test.ts` (new — the repo's first server
test), `AppError.resolvedRole` plus the role-denial sites, `role=` on the 401/403 WARN line,
`HTTP_STATUS`/`HttpStatusCode` in contracts with `ERROR_STATUS` rewritten to named members, the
parity-script regex change, and the revert of two server controllers back to Nest's `HttpStatus`.
Phase 1 run because it touched contracts (shared by both sides), the global exception filter, and a
repo tool.
**Files touched:** `server/src/common/app-error.ts`, `server/src/wallets/wallet-access.service.ts`,
`server/src/goals/goal-access.ts`, `server/src/goals/goal-contributions.service.ts`,
`server/src/budgets/budgets.service.ts`, `server/src/common/envelope.interceptor.ts`,
`server/src/{auth,wallets,accounts,goals,transactions,categories,budgets}/*.controller.ts`,
`mobile/src/services/api/client.ts`, `server/test/routes.test.ts`, `CLAUDE.md`, `README.md`
**Related reports:** [2026-09-03-infra-audit.md](2026-09-03-infra-audit.md),
[2026-09-03-route-wiring-double-check.md](2026-09-03-route-wiring-double-check.md),
[2026-09-03-comment-audit-session-changes.md](2026-09-03-comment-audit-session-changes.md).
Follow-up carried forward and now **closed**: the infra audit's "add a route-table assertion" and the
comment audit's "add `role` to the 401/403 WARN line".

## Method

Phase 1 delegated to a read-only agent scoped to the diff; every finding it returned was re-verified
against the live files here before being acted on. Commands:

```
npm run typecheck                                   # all workspaces
npm test                                            # all workspaces: 61 + 3 + 36
node scripts/check-contract-parity.mjs              # 31/31
npm test -w @sora/server                            # with GoalsModule unregistered, to prove it fails
node server/dist/src/main.js (inline env, :3099)    # 52 routes; curl each changed path
```

## Findings

### 1. FIXED — the change created a three-way split on status codes

The session left three vocabularies for one concept: contracts' `HTTP_STATUS`, Nest's `HttpStatus` (in
the two controllers reverted at the user's direction), and **15 bare numeric literals** that predate
this session — `@HttpCode(200)`/`@HttpCode(204)` across `auth.controller.ts:44,55,66,75`,
`wallets.controller.ts:130,163,175,187,219`, `goals.controller.ts:74,103`,
`accounts.controller.ts:65`, `budgets.controller.ts:64`, `categories.controller.ts:62`,
`transactions.controller.ts:62`. Verified by grep before acting.

Resolved along the axis already chosen: **Nest's enum in server code, contracts' enum where Nest
cannot reach.** All 15 converted to `HttpStatus.OK`/`HttpStatus.NO_CONTENT`, with `HttpStatus` added
to each file's existing `@nestjs/common` import. `grep -rn "@HttpCode([0-9]" server/src` now returns
nothing.

### 2. FIXED — `envelope.interceptor.ts:30` compared against a bare `204`

Same `common/` directory as the filter that was converted, and it decides whether to wrap a response
body at all. Now `HttpStatus.NO_CONTENT`.

### 3. FIXED — `mobile/src/services/api/client.ts:53` compared against a bare `401`

The only status literal in the app, and it gates the token-refresh retry — the one place a wrong
number would silently break session renewal. Now `HTTP_STATUS.UNAUTHORIZED` from the contract, which
is exactly the case the contracts-side enum exists for (mobile cannot import Nest).

### 4. FIXED — `AppError('FORBIDDEN', undefined, undefined, role)` had no precedent in this repo

Of 90 `new AppError(` call sites, only 8 pass two or more arguments, and the precedent is for a
*single* placeholder (`goal-contributions.service.ts:102,250`). Two positional `undefined`s to reach
a fourth parameter was mine alone, and unreadable.

Replaced with a named factory, `AppError.forbidden(role)`, so all five denial sites read
`throw AppError.forbidden(row.role)`. The positional form now appears exactly once, inside the
factory. Verified: `grep -rn "AppError('FORBIDDEN'" server/src` matches only `app-error.ts:40`.

### 5. FIXED — my own filter comment was inaccurate for one 403

`goal-contributions.service.ts:95` throws `FORBIDDEN` when a contribution's account belongs to a
different wallet than the goal. It is genuinely *not* a role check — it runs after
`requireAccount(..., 'VIEWER')` has already passed — so I had left it roleless. But `account.role`
**is** in scope there (verified by reading the function), which made my new comment at
`all-exceptions.filter.ts:49-51` — "`role` is `none` where no membership resolved at all" — false for
this path: a role had resolved, and the log would still have said `none`.

Fixed by passing it: `throw AppError.forbidden(account.role)`. The comment is now true of every 403.

### 6. FIXED — the new test diverged from the repo's assert-import convention, 5 to 1

All five pre-existing test files use `import { strict as assert } from 'node:assert'`
(`packages/contracts/test/{calc,money,schemas}.test.ts`, `mobile/src/services/auth/session.test.ts`,
`mobile/src/utils/transactionForm.test.ts`). Mine used `import assert from 'node:assert/strict'`.
Functionally identical; changed to match.

### 7. FIXED — three stale documentation claims

- `CLAUDE.md` said the contracts suite was "~37 assertions". Measured: **61 tests, 108 `assert.*`
  calls**. Corrected, and a `npm test -w @sora/server` line added beside it.
- `CLAUDE.md`'s project tree showed `server/` containing only `src/`. A `test/` sibling now exists
  (contracts' was already listed), so the tree was redrawn to include it.
- `README.md`'s checks block listed only the contracts suite. Added the server one.

`docs/API_SPECIFICATION.md:119` deliberately defers to `responses.ts` for the status map, so the
`ERROR_STATUS` shape change is invisible to it — **no change needed**, confirmed rather than assumed.

### 8. The route assertion was proven to fail, not just to pass

A test that passes proves nothing about whether it would catch the bug. `GoalsModule` was temporarily
removed from `AppModule`'s `imports` and the suite re-run:

```
✖ mounts every path declared in ROUTES
  AssertionError: declared in ROUTES but not mounted (a controller or its module is unwired):
  /goals, /goals/*, /goals/*/contributions, /goals/*/contributions/*
✖ mounts at least one route per resource group
  AssertionError: resource groups with no mounted route: goals
```

Then restored — `git diff server/src/app.module.ts` empty — and green again. The parity-script regex
change got the same treatment: deleting one `ERROR_STATUS` line produced
`FAIL every ERROR_CODE has an ERROR_STATUS — missing: GOAL_NOT_ACTIVE`, 30/31, confirming the looser
pattern did not weaken the check.

### 9. Checked and clean

- `HTTP_STATUS` and `HttpStatusCode` are reachable from the barrel (`packages/contracts/src/index.ts:13`
  does `export *`), confirmed by the server importing and typechecking.
- The parity script's outer regex still matches: it looks for `[^=]*` before `= {`, and
  `Record<ErrorCode, HttpStatusCode>` contains no `=`. It extracts only keys, never values.
- The new test needs no database: `DatabaseService`'s only query is `ping()`, not a boot hook, so
  `app.init()` against a dead DSN is safe. Every env var the test does not set has a Zod default, and
  the ones it does set use `??=` so CI's real values win. `ROUTES` has no optional parameters, so the
  `node.length` arity walk is complete.
- **CI will run it**: `.github/workflows/ci.yml:130` already invokes
  `npm run test --workspace @sora/server`, which previously asserted nothing.
- `mobile/src/utils/errors.ts` correctly types `status: number` rather than `HttpStatusCode` — a proxy
  can return a 502 that is not in the contract's set.
- The revert of the two controllers was exact: neither appears in `git status`, i.e. both are
  byte-identical to their committed state.
- Live after every fix: 52 routes, health 503 (DB down), `/health` 404, transactions 401, logout 401,
  preview 422 — all unchanged from before the refactor.
- `server/src/verify-boot.ts` is still referenced by nothing but `verifications/` prose.

## Fixes Applied

| # | File | Change | Re-verified by |
|---|---|---|---|
| 1 | 7 controllers | 15 `@HttpCode(NNN)` → `HttpStatus.*` | typecheck; grep returns no bare literal; live 401/422 |
| 2 | `envelope.interceptor.ts:31` | `204` → `HttpStatus.NO_CONTENT` | typecheck; live responses unchanged |
| 3 | `mobile/src/services/api/client.ts:10,53` | `401` → `HTTP_STATUS.UNAUTHORIZED` | mobile typecheck; 36/36 |
| 4 | `app-error.ts:33-41` + 5 sites | `AppError.forbidden(role)` factory | typecheck; grep confines positional form to the factory |
| 5 | `goal-contributions.service.ts:95` | pass `account.role` | typecheck; makes the filter comment true |
| 6 | `server/test/routes.test.ts:2` | match assert-import convention | 3/3 still pass |
| 7 | `CLAUDE.md`, `README.md` | test count, `server/test/` in the tree, server test command | counts measured, not estimated |

Final state: `npm run typecheck` clean across all workspaces; `npm test` **100 tests** (61 contracts +
3 server + 36 mobile), 0 failures; parity 31/31.

## Follow-ups

- **Real-data exercise is available in CI, not just blocked locally.** `.github/workflows/ci.yml:91-103`
  provisions and migrates a real PostgreSQL 17 for the server job. The `403`-with-an-actual-role path,
  AC-01's 404-vs-403 boundary and the LA-02 audit-row assertions could all be tested there — the gap
  is written tests, not infrastructure. This supersedes the "BLOCKED, no database role" note in the
  earlier reports as far as CI is concerned.
- `server/src/verify-boot.ts` still wants deleting (47 dead lines) — needs explicit permission.
- `transferOwnershipSchema` still absent from `@sora/contracts`; `InvitationState` still declared
  three times. Both carried forward, unchanged.
- `server`'s test script still exits 0 if it finds no test files; now moot in practice, but the guard
  would prevent a silent regression to zero coverage.
