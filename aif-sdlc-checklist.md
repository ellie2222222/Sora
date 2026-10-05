# AIF-SDLC Review Checklist

**Sora — shared-wallet finance tracker (NestJS API + Expo app)**

The item-by-item form of CLAUDE.md Part 5 → Definition of Done. Run it for each feature (a user-story
group) before merging to `main`. Where this file and CLAUDE.md disagree, CLAUDE.md wins — fix this file.

---

## 1. Traceable

- [ ] The user story exists in `SRS.md` §9, with acceptance criteria and its prefix (e.g. `BUD-US-01`)
- [ ] It traces to the CDM (`SRS.md` §2) or a business flow (§8), and conflicts with no business rule (§4, BR-01…BR-16)
- [ ] Its endpoint(s) are in `docs/API_SPECIFICATION.md` (auth, role, validation, errors, side effects)
- [ ] `SDS.md` §8 Feature Implementation Mapping names the real controller/service/screen

## 2. Contract-first

- [ ] Enums, Zod schemas, response types, error codes and route paths live in `packages/contracts/src/`, defined once
- [ ] New error codes are `UPPER_SNAKE_CASE`, resource-prefixed, and in both `ERROR_CODES` and `ERROR_STATUS`
- [ ] Routes come from `ROUTES`, never a literal string
- [ ] Money crosses the wire as a string and is computed as scaled `bigint` (`money.ts`, `calc.ts`), never `Number(amount)`
- [ ] `node scripts/check-contract-parity.mjs` passes

## 3. Authorized

- [ ] The minimum role is enforced server-side through `roleSatisfies()`; hiding a button is not a control (AC-02)
- [ ] No membership row → **404**; member with too low a role → **403** (AC-01)
- [ ] A cross-wallet write checks `EDITOR` on **every** wallet it touches (AC-03, BR-02)
- [ ] Financial mutations and membership/role changes write an `audit_logs` row (LA-02) inside the write's own transaction, with a savepoint so an audit failure can't roll the write back (CLAUDE.md Part 7 rule 16)
- [ ] 401/403 are logged at WARN with actor, role and target (LA-03); no secrets in logs (LA-01)

## 4. Validated

- [ ] Zod from `@sora/contracts` at the edge, on both the server and the mobile form (MB-03, VL-01)
- [ ] Service checks for anything that needs a lookup: 404 missing, 409 archived/deleted (VL-03)
- [ ] A database constraint (`chk_`/`uq_`/`excl_`) backs every rule that must hold for any writer (Part 7 rule 4)
- [ ] Uniqueness: an index is the guarantee, the service check produces the clean 409 (VL-02)

## 5. Derived, not stored

- [ ] No new column caches a balance, spent, remaining or progress figure (BR-05)
- [ ] Transfers are excluded from income/expense/budget figures (BR-06)
- [ ] Nothing is summed across currencies (BR-07)
- [ ] Nothing financial is hard-deleted — archive, `DELETED` status or revoke instead (sole exception: an unused category, spec §10.4)

## 6. Tested

- [ ] Contracts: `npm test -w @sora/contracts` covers new schema/money/calc logic
- [ ] Server: `npm test -w @sora/server` with `DATABASE_URL` on a disposable database, so `integration.*.test.ts` run rather than skip (a skip prints `[integration] SKIPPED`, not a failure), plus a unit test per new pure helper
- [ ] Database: new constraints get a probe in `db/tests/`; `npm run db:test` passes
- [ ] Live path: every new/changed endpoint exercised against a disposable Postgres with synthetic data (`scratch-probe` skill), including each documented error and the 404-vs-403 boundary
- [ ] Mobile: `npm test -w @sora/mobile` covers new utils; `npx tsc --noEmit` is clean; `npx expo export --platform android` bundles
- [ ] `npm run typecheck` is clean across every package
- [ ] The feature's plan in `docs/test-plans/` lists every new or changed case, with the `file:line` of its test and an up-to-date status

## 7. Specs updated

- [ ] `docs/API_SPECIFICATION.md` matches what was built
- [ ] `SRS.md` §9 acceptance criteria and `SDS.md` §7 (schema) / §8 (mapping) are updated in the same change
- [ ] The plan's phase checkboxes (`plans/…`) reflect reality

---

## Database migrations

- [ ] A new file under `db/migrations/` — never an edit to an applied one (the runner checksums them)
- [ ] It ends in `COMMIT;` (the runner commits it together with its `schema_migrations` row)
- [ ] Constraint names use the load-bearing prefixes (`chk_`, `uq_`, `idx_`, `excl_`) the parity check reads
- [ ] A new constraint on a populated table uses `NOT VALID` + `VALIDATE CONSTRAINT` to avoid a full-table lock
- [ ] Applied twice on a disposable database (`node scripts/migrate.mjs`, then `--status`); the second run is a no-op

## Mobile

- [ ] TypeScript `strict`; no `any` without a comment saying why (MB-01)
- [ ] Server state through RTK Query slices; no copy in plain Redux; no `zustand` or `@tanstack/react-query` (MB-02)
- [ ] `testID`s follow NC-04 (`screen-…`, `input-…`, `btn-…`, `sheet-…`)
- [ ] Icons from `lucide-react-native` (MB-05); colours from design tokens, dark and light both checked (MB-06)
- [ ] Loading, empty, error and success states all handled (MB-07)
- [ ] Money rendered via `<Money>` / `formatMoneyString` (MB-08)
- [ ] Every new string is in `en.ts` **and** `vi.ts`, at full parity; inactive locales untouched (MB-09, rule 13)
- [ ] Cross-directory imports go through `@/…` barrels, siblings relative (MB-10, rule 14)
- [ ] No function `style` on a `Pressable` (rule 15)
- [ ] `docs/DESIGN_GUIDELINES.md` Part 4 check run (MB-11)

## Code review

- [ ] Controllers are thin (HTTP binding and guards); business rules live in services; Kysely queries are parameterized
- [ ] List endpoints paginate (API-05); no N+1 — aggregates in SQL
- [ ] No hard-coded config: every variable is read through `server/src/config/env.ts`
- [ ] Comments explain *why*, never *what*; no untracked `TODO` (rule 11)
- [ ] Terminology matches CLAUDE.md's table (Wallet, Member, Account, Transaction, Budget, Saving Goal)

---

## Pre-merge

- [ ] All checks above pass locally, and CI is green
- [ ] Commits were drafted by the `commit-messages` skill, not hand-written — see CLAUDE.md's Git section
- [ ] No `Co-Authored-By: Claude ...`, "Generated with Claude Code", or model name anywhere in the commit messages, PR body, code comments, or docs
- [ ] Migration tested against a disposable database only — never `docker compose down -v` or anything else that wipes real data; see CLAUDE.md's Data Safety section
- [ ] Any verification/double-check/audit pass produced a `verifications/YYYY-MM-DD-slug.md` report

## Post-merge

- [ ] `node scripts/migrate.mjs` against the target, then `GET /api/v1/health` reports `"database": "up"`
- [ ] Smoke-test the happy path; confirm audit rows are written
- [ ] `RUNBOOK.md` updated if an operational step changed

---

## Common failures

| Failure | Cause | Fix |
|---|---|---|
| 403 for a wallet the user has no access to at all | Should be 404 — a 403 confirms the id is real (AC-01) | 404 with no membership row; 403 only for "member, role too low" |
| A balance off by a fraction nobody can trace | An amount went through a JS number (rule 1) | Scaled `bigint` via `money.ts`; keep the `pg-types.ts` parsers |
| A write "succeeds" but the row is gone | A swallowed error inside the transaction turned `COMMIT` into a rollback (rule 16) | Savepoint the best-effort write, or run it outside the transaction |
| Server returns 500 on a valid-looking enum | Enum tuple and `CHECK` constraint disagree | Fix at the contract; `check-contract-parity.mjs` |
| Mobile form passes, server rejects | The form wasn't validated with the contract schema | `schema.safeParse` from `@sora/contracts` (MB-03) |
| A `Pressable` loses its background/padding | Function `style` under NativeWind interop (rule 15) | Track pressed state; pass a plain object |
| A require cycle warning after adding an export | A barrel re-exports an orchestrator (rule 14) | Deep-import the orchestrator; keep it out of the barrel |
| Green CI that tested nothing | A job-level `hashFiles()` guard (rule 8) | Guard at step level, or use `needs:` |

Exceptions are fine with the reason written in the PR description. When a checklist item turns out to be
missing, add it here, and add the rule to CLAUDE.md first if it's a new standing rule.
