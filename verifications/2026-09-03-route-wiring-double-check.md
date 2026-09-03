# Double-check of the route-wiring fixes — found a contract duplication and a 500-response internals leak

**Date:** 2026-09-03T14:57:41Z
**Method:** double-check skill
**Verdict:** PASS (two findings, both fixed and re-exercised)
**Scope:** This session's uncommitted changes only: the three server route-wiring fixes
(`app.module.ts`, `main.ts`, `invitations.controller.ts`, `wallets.module.ts`) and the `README.md`
health-URL correction. Phase 1 run because the change touched shared server bootstrap.
**Files touched:** `packages/contracts/src/schemas.ts`, `packages/contracts/src/responses.ts`,
`server/src/wallets/invitations.controller.ts`, `server/src/wallets/invitations.service.ts`,
`server/src/common/all-exceptions.filter.ts`, `mobile/src/services/api/invitations.ts`
**Related reports:** [2026-09-03-infra-audit.md](2026-09-03-infra-audit.md) — this pass double-checks
the fixes that report applied, and carries forward none of its follow-ups as done (they remain open).

## Method

The delegated Phase 1 agent died on a transient API 529, so the sweep was run by hand instead —
noted because it changes how the findings below were reached, not just that they were.

```
grep -rn "localhost:3001|localhost:8091|/api/v1|127.0.0.1:3001" (all tracked source, docs, yml, Dockerfile, .env.example)
grep -rln "@Module" server/src ; grep -rln "@Controller" server/src      # exhaustive wiring check
sed -n '10,35p' docker-compose.yml ; grep -n "HEALTHCHECK|curl|wget" server/Dockerfile
npm run build -w @sora/contracts ; npm run typecheck -w @sora/server ; npm run typecheck -w @sora/mobile
node scripts/check-contract-parity.mjs ; npm test -w @sora/contracts
node server/dist/src/main.js  (inline env, port 3099) + curl against the changed routes
```

## Findings

### 1. Prefix blast radius — clean

Every hardcoded API reference in the repo was enumerated and checked against the newly mounted
prefix. All correct: `RUNBOOK.md:21,59,166`, `README.md:146,224`, `SDS.md:391-393,425,479`,
`docs/API_SPECIFICATION.md:4`, `aif-sdlc-checklist.md:85,108` all already say `/api/v1`.
`.env.example:72` and `mobile/src/app/config/env.ts:12` correctly hold the **base URL with no
prefix** (`apiUrl()` adds it) — changing those would have double-prefixed every call.
`docker-compose.yml`'s only healthcheck is Postgres's `pg_isready`, and `server/Dockerfile` declares
no `HEALTHCHECK`, so neither referenced the old path. `webpage/**` hits are the parked pre-pivot
stack (`webpage/PARKED.md`) and run against nothing.

### 2. Module and controller wiring — exhaustively verified

Because the original bug was precisely "a module nobody imported", this was checked by enumeration
rather than by spot-check. 17 files declare `@Module`: 13 reachable directly from `AppModule`, plus
`balance.module` and `wallet-access.module` (imported by the feature modules), plus `app.module`
itself, plus `verify-boot.ts` (dead scratch file). 10 files declare `@Controller`, and all 10 are
registered in a module now reachable from `AppModule`. The live route table confirms it arithmetically:
wallets 14 + goals 8 + auth 7 + transactions 5 + budgets 5 + accounts 5 + categories 4 + invitations 2
+ health 1 + dashboard 1 = **52**, matching `grep -c Mapped`. No module or controller is orphaned.

### 3. FIXED — the new controller duplicated the contract three ways (Part 7 rule 7)

`previewInvitationSchema`, which I had declared locally in the new controller, was
`z.object({ token: z.string().min(1) })` — character-for-character the shape of
`acceptInvitationSchema` in `packages/contracts/src/schemas.ts:152`. Worse, grepping outward found
the response type declared **twice independently**, in `server/src/wallets/invitations.service.ts:24`
and `mobile/src/services/api/invitations.ts:21`, with identical fields and a mobile comment
explaining that "the preview body has no type in @sora/contracts" — i.e. the drift was already
known and documented rather than fixed.

This is the exact failure mode CLAUDE.md Part 5 (The Shared Contract) and Part 7 rule 7 exist to
prevent, and the parity check cannot catch it: it compares enums, routes and error codes, not
response interfaces.

Fixed contract-first: added `previewInvitationSchema` + `PreviewInvitationRequest`
(`schemas.ts`) and `InvitationPreviewResponse` (`responses.ts`), then deleted all three local
copies and pointed server and mobile at the contract. `grep -rn "InvitationPreview" mobile/src
server/src packages/contracts/src | grep -v InvitationPreviewResponse` now returns nothing.

The two request schemas are deliberately kept as separate names despite the identical shape — §8.4
is public and §8.5 is not, so one name over both would make a later divergence a breaking rename.
That reasoning is in the schema's own comment.

### 4. FIXED — every 500 returned the raw exception message to the client

Found by actually driving the new route rather than by reading it: `POST /api/v1/invitations/preview`
with a real token reached the service, ran its query, and answered

```json
{"success":false,"message":"password authentication failed for user \"postgres\"","error":{"code":"INTERNAL_ERROR"}}
```

`all-exceptions.filter.ts:110` was `message: exception instanceof Error ? exception.message :
'Unexpected error'` — so any unhandled error's own text went to the caller. A Postgres error names
the database user here, and elsewhere would name constraints, columns, or hosts. Nothing in
CLAUDE.md's Security Requirements permits that, and it is the kind of leak that only ever surfaces
in production logs of someone else's making.

Fixed by splitting the client-facing string from the logged one: `Classified` gained an optional
`internal` field, the unknown-error branch returns a fixed `'Unexpected error'` and puts the real
text in `internal`, and the existing `status >= 500` ERROR log (already present at lines 54-58) now
logs `internal ?? message`. Domain errors are untouched — `AppError` and `ZodError` still surface
their own messages, which are written by this codebase and safe by construction.

Re-verified with the same request that exposed it: client body is now
`{"message":"Unexpected error","error":{"code":"INTERNAL_ERROR"}}`, while the server log still
carries `INTERNAL_ERROR actor=anonymous target=POST /api/v1/invitations/preview: password
authentication failed for user "postgres"`. The 422 path is unchanged
(`{"fields":{"token":["Required"]}}`).

### 5. Controller conventions — matches the established pattern

Checked against `wallets.controller.ts`, `auth.controller.ts`, `health.controller.ts`: bare
`@Controller()` with paths from `ROUTES` (never a literal), `zodPipe(schema)` on `@Body`,
`@CurrentUser()`/`@ClientIp()` param decorators, `@Public()` for unauthenticated routes, and
multi-line class-level rationale comments. `@HttpCode(HttpStatus.OK)` on both routes is required and
correct: Nest defaults `@Post` to 201, and spec §8.4/§8.5 both specify **200**. Keeping these two
routes off `WalletsController` is necessary, not stylistic — that class applies
`RequireWalletRoleGuard` at class level, which a pre-membership token-addressed route cannot satisfy.

### 6. Comment review of the change — clean

Both added comments are why-only and carry no investigation narrative, per CLAUDE.md rule 11 and the
standing no-debug-journal rule: `main.ts`'s three lines state the caller assumption and cite API-01;
the controller's block explains why the routes sit outside `/wallets/{id}/**` and why they need
their own class. Neither fact is derivable from the code. Multi-line class-level rationale blocks are
this repo's established style (`app.module.ts`, `wallets.controller.ts`, `health.controller.ts` each
carry one), so these match rather than diverge.

### 7. Still BLOCKED — no real-data exercise

Unchanged from the infra audit: no usable Postgres role in this environment, and `.env` carries no
`DATABASE_URL`. Routing, validation, auth gating and the error-path fix are all verified over real
HTTP; no query result, constraint, or derivation has been exercised against real rows.

## Fixes Applied

1. [packages/contracts/src/schemas.ts:156-165,393](../packages/contracts/src/schemas.ts#L156-L165) —
   added `previewInvitationSchema` and `PreviewInvitationRequest`.
2. [packages/contracts/src/responses.ts:231-241](../packages/contracts/src/responses.ts#L231-L241) —
   added `InvitationPreviewResponse`, the contract home for a DTO that had two local copies.
3. [server/src/wallets/invitations.controller.ts](../server/src/wallets/invitations.controller.ts) —
   dropped the local schema, imports both from the contract.
4. [server/src/wallets/invitations.service.ts](../server/src/wallets/invitations.service.ts) —
   deleted the local `InvitationPreview` interface, returns `InvitationPreviewResponse`.
5. [mobile/src/services/api/invitations.ts](../mobile/src/services/api/invitations.ts) — deleted its
   local copy and the now-obsolete comment about the type being absent from contracts.
6. [server/src/common/all-exceptions.filter.ts:46,56,72-78,107-116](../server/src/common/all-exceptions.filter.ts#L107-L116)
   — `internal` field; generic client message for unhandled errors; real text still logged.

Re-verification after all six: `build -w @sora/contracts` clean, `typecheck -w @sora/server` clean,
`typecheck -w @sora/mobile` clean, `check-contract-parity.mjs` **31/31**, `@sora/contracts` **61/61**,
server rebuilt and rebooted → **52 routes**, and the four live curls above.

## Follow-ups

- `InvitationState` (`'open'|'accepted'|'revoked'|'expired'`) is *still* declared twice —
  `server/src/wallets/invitations.service.ts:22` and `mobile/src/services/api/invitations.ts:14` —
  and inlined a third time as a `z.enum` in `wallets.controller.ts:67`. Not consolidated this pass
  because it is an enum, and `check-contract-parity.mjs` asserts every enum tuple in the contract
  against a matching `CHECK` constraint; this one is a query filter with no such column, so moving it
  needs the parity script understood first rather than guessed at.
- All follow-ups from [2026-09-03-infra-audit.md](2026-09-03-infra-audit.md) remain open, in
  particular the route-table assertion (without it, findings 1-3 of that report can recur) and
  deleting `server/src/verify-boot.ts`, which still needs explicit permission.
- The generic-500 fix means an unhandled error is now only diagnosable from the server log. That is
  the correct trade, but it raises the value of the missing crash/error reporting noted in the infra
  audit's Tier 2.
