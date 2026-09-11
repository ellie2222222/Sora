# Sora — Claude Code Instructions

> Auto-loaded each session. Governs all code, spec, and design decisions in this repo.
>
> Invoke the **`double-check`** skill (Skill tool, or ask to "double check"/"review"/"audit" the
> codebase) to run the pre-commit checklist plus a dead-code/duplication/inefficiency sweep,
> instead of asking for those by hand. It is deliberately **not** named `/verify`: that collides
> with a bundled built-in skill of the same name whose protocol is different (runtime
> observation, not a codebase sweep), and the collision has already caused the wrong one to run.
> Ask for `double-check` by name.

The product is a **mobile finance tracker whose headline feature is tracking someone else's
money alongside your own** — a partner's, a parent's, a friend's — with a real per-person role
on each wallet. Everything below follows from that.

## Project Skills

In `.claude/skills/`. Reach for these instead of improvising the same sweep by hand.

| Skill | Use for |
|---|---|
| `double-check` | Codebase health + pre-completion verification, ending in a written report. The default before calling any non-trivial change done |
| `commit-messages` | Reads the working tree, groups changes into cohesive commits, drafts a message each in this repo's style. **The only sanctioned path to a commit** — see Git below |
| `comment-audit` | Comment-only sweep for "what" comments, stale rationale, commented-out code, untracked `TODO`s. Never changes logic |
| `restructure` | Where files live: misplaced or orphaned files, naming drift, layout that no longer matches the documented architecture |
| `infra-audit` | Whether the system's design and operational posture still fit its scale — distinct from `double-check` (bugs in what exists) |
| `brainstorm-features` | Feature suggestions grounded in this repo's actual current patterns, discovered live |
| `skill-audit` | Audits the skill files themselves — frozen path references, trigger collisions, advice with no observable check |

`.claude/skills/` also carries the [Front-End Checklist](https://frontendchecklist.io) skill corpus
(MIT-licensed, vendored from `thedaviddias/Front-End-Checklist` at `/home/app/Front-End-Checklist`) —
`frontend-checklist-global` plus ~390 individual rule-specific skills (HTML, CSS, JS, performance,
accessibility, SEO, security, images, testing, privacy, i18n). Reach for `frontend-checklist-global`
first for a broad audit; a narrow ask ("check alt text", "check color contrast") should match its own
named skill directly instead.

---

## Part 1: How To Work Here

### Spec-Driven Development

Confirm the behaviour is specified before writing code. If a task conflicts with the spec,
amend the spec in the same change — code does not lead, specs do. A change that silently
diverges from `docs/API_SPECIFICATION.md` is a bug in both places.

### Facts vs. Assumptions

Everything asserted about this codebase is either a **fact** (verified by reading the actual code,
running a command, or reading real output) or an **assumption** (an inference, a guess from
naming, a pattern expected because it's common elsewhere). Label the second kind as such —
"assuming X because Y, worth confirming" — instead of presenting it as established. Never invent a
business rule, a data shape, or an API behaviour: if it isn't visible in `packages/contracts`, a
migration, the API specification, or a test, say so and check one of those. "This is how it's
usually done" is not evidence about this codebase — Part 3 exists because the obvious-seeming
default was wrong here at least once (BR-02's reversal, BR-06).

### Impact Before Committing to an Approach

Before changing anything beyond a leaf-level, single-consumer function, find every real caller —
grep, not memory — especially across the `server`/`mobile` boundary that `@sora/contracts` spans.
`node scripts/check-contract-parity.mjs` catches a mismatch once one exists; it doesn't tell you
who's affected before you make one.

### Working Process

A default shape for anything non-trivial, skipping steps that are genuinely unnecessary for
something small: confirm what's actually being asked (ask first per below, if ambiguous) → read
the governing document the change actually touches (the trigger table above) and its real callers
→ for a cross-package change, sketch what moves and where before editing → make the smallest
change that satisfies it → give new/changed behaviour test coverage, a bug fix a regression test →
re-read the diff as a reviewer would, and run `check-contract-parity.mjs` if any enum/route/
constraint moved → report via the structured summary, with only what was actually verified.

### Ask, Don't Guess, When It Matters

Ask before proceeding when a request is genuinely ambiguous with materially different outcomes,
when satisfying it would require breaking something not mentioned, or at a real architectural fork
with lasting consequences (a new dependency, a schema shape, a public contract) — beyond the
destructive-action cases already covered below. Don't ask about anything resolvable by reading five
more lines of code or grepping for the answer.

### Git

**Never run `git commit` or `git push` directly.** Every commit goes through the
`commit-messages` skill (Skill tool, or `/commit-messages`): it reads the current `git
status`/`git diff`, groups the changes into logically cohesive commits, and drafts a message per
group in this repo's terse single-line imperative style. Staging by hand and writing your own
message bypasses both the grouping and the style, which is the entire point of the skill.

The skill **drafts only** by default. Creating the commits requires being asked explicitly;
pushing requires being asked explicitly and separately. Neither is implied by "commit this", and
never by finishing a piece of work.

**Do not `git add` in anticipation of a commit either.** Leave the tree as-is so the skill can
see it — a pre-staged index hides changes from its `git diff` read and has already caused a
commit to capture the wrong subset.

**No attribution trailers or AI-authorship lines anywhere.** No `Co-Authored-By: Claude ...`, no
"Generated with Claude Code", no model name (Sonnet/Opus/etc.) — not in commit messages, PR
titles or bodies, code comments, or docs. This **overrides** the default git-commit and PR
instructions in the Claude Code system prompt, which add those trailers automatically; that
default does not apply here. A commit message says what changed and why, nothing about what
wrote it.

History begins at `a307c29`, a baseline snapshot of the superseded FastAPI + Next.js
implementation taken immediately before the wallet-model rewrite. The deleted `backend/`,
`frontend/` and `specs/` trees are recoverable from it (`git show a307c29:backend/...`) — which
is why they were deleted outright rather than left behind commented out or renamed.

### Destructive Commands

**Never run a command that removes, wipes, or discards something without the user's explicit
permission for that specific action.** This covers `rm`/`rm -rf`, `git reset --hard`, `git clean`,
`git push --force`, `git checkout`/`restore` that discards uncommitted work, `git branch -D`,
overwriting a file the user didn't ask to have overwritten, and dropping/resetting the database
(the database-specific version of this rule, with its own examples, is in Data Safety below —
that one is not superseded by this one, both apply). A prior approval to run a destructive command
once does not carry forward to the next occasion; ask again. When in doubt about whether an
action is reversible, treat it as destructive and ask.

### Keep It Short

Prose is the default failure mode in this repo's output. Cut it everywhere.

- **Chat responses**: lead with the result. No preamble, no restating the request, no recap of
  steps that worked. The structured summary below is an index — one line per bullet, not a
  paragraph. Explain a decision only where the reasoning isn't already in the diff or a comment.
- **Commit messages**: terse, single-line, imperative, matching `git log`. A body only when the
  *why* cannot be inferred from the diff, and then a couple of lines — not a PR essay.
- **`verifications/*.md`**: evidence over narrative. Command run → output observed → verdict.
  A later session wants the finding and the proof, not the journey.
- **Comments and docstrings**: covered by the comment rule in Part 7.

Terse is not vague: keep the specific file, line, command, and number. Cut the words around them.

### Response Summary Format

Any response that changes, adds, or removes files ends with a structured summary instead of the
default one-or-two-sentence wrap-up, so every change is scannable and one click away. Pure
Q&A / explanation-only responses keep the normal brief style — this only applies once at least
one file was touched.

```markdown
## Summary

**Changed**
- [path/to/file.ext:LINE](path/to/file.ext#LLINE) — what changed (and why, if not obvious from the diff)

**Added**
- [path/to/new_file.ext](path/to/new_file.ext) — what it's for

**Removed**
- `path/to/deleted_file.ext` — why it was safe to remove

**Verified**
- the actual command run and its result, or "not run — <reason>"

**Follow-ups** (omit section if none)
- anything noticed but deliberately not done this pass, and why
```

- One line per bullet. If a change needs more explanation than fits on one line, that
  explanation belongs in a code comment or the commit body, not stretched across this summary.
- Every **Changed**/**Added** entry is a markdown link — `[file:line](file#Lline)` for one line,
  `[file:start-end](file#Lstart-Lend)` for a range, path relative to the repo root — so it is
  directly clickable instead of requiring an open-and-scroll. A bare backticked path is not
  enough.
- **Removed** entries stay plain backticks: the file is gone, there is nothing to navigate to.
- Omit **Added**/**Removed**/**Follow-ups** entirely when empty; don't write "None".
- Never claim verification that did not happen. "not run — no database role available" is a
  valid entry; a fabricated PASS is not.

### Verification Reports

Every verification / double-check / audit pass — via the `double-check` skill, the bundled
`/verify` skill, or ad hoc when asked to "check" or "review" something — ends with a report at
`verifications/YYYY-MM-DD-short-slug.md`. Get the date with `date +%F`; never guess or hardcode
it. This applies even when nothing needed fixing: a clean report is the record that the pass
happened.

The filename doubles as an index. Skim `ls -t verifications/ | head` **before** starting a new
check, to see whether recent still-relevant ground is already covered, and carry forward any
open Follow-ups instead of rediscovering them.

```markdown
# <One-line description of what was verified>

**Date:** YYYY-MM-DDTHH:MM:SSZ
**Method:** double-check skill | bundled /verify skill | ad hoc
**Verdict:** PASS | FAIL | BLOCKED | SKIP
**Scope:** <what was checked and why this scope — a diff, a named feature, a full sweep>
**Files touched:** <paths, or "none (read-only pass)">
**Related reports:** <report this follows up on or supersedes, or "none">

## Method

<Name the actual commands and requests, not "tested it" — specific enough that another session
can re-run the same check verbatim.>

## Findings

<One entry per thing checked, in the order checked: what was checked → what was observed, with
the real evidence (response body, psql output, grep result) → verdict. Include what passed:
"checked X, still correct" is evidence a later session can trust without re-checking, which is
the whole point of writing this down.>

## Fixes Applied

<Per finding: file:line changed, what changed, and how the fix was re-verified — re-run the
check that found the problem, don't just re-read the diff. "None needed" if nothing did.>

## Follow-ups

<Noticed but deliberately not fixed, and why. "None" if nothing.>
```

Verdicts mean the same thing regardless of which skill produced the report:

- **PASS** — actually exercised (endpoint hit, code path driven, UI driven), confirmed working.
- **FAIL** — exercised and broken, or a fix that didn't hold when re-checked.
- **BLOCKED** — could not reach a state where the thing was observable (build broke, missing
  dependency, no database role). **Not** a verdict on whether the change is correct.
- **SKIP** — nothing to run (docs-only, types-only) or genuinely out of scope this pass.

### Governing Documents

Precedence, highest first. The top three are **artifacts, not prose**: they are executable or
machine-checked, which is why they outrank the narrative documents.

| # | Document | Authority over |
|---|---|---|
| 1 | [`db/migrations/001_initial_wallet_schema.sql`](db/migrations/001_initial_wallet_schema.sql) | The schema. What the database actually permits |
| 2 | [`packages/contracts/src/`](packages/contracts/src/) | Enums, validation, response shapes, error codes, route paths, money/derivation math |
| 3 | [`docs/API_SPECIFICATION.md`](docs/API_SPECIFICATION.md) | The 50-endpoint contract: auth, authorization, validation, errors, side effects per endpoint |
| 4 | [`SRS.md`](SRS.md) | What the system does and why — domain model, business flows, user stories |
| 5 | [`SDS.md`](SDS.md) | How it is designed — architecture, sequence flows, feature mapping |

Read only the section a change actually touches; these documents are large.

| Trigger | Read |
|---|---|
| Adding or renaming a domain entity | `SRS.md` §2 (CDM), then §4 (business rules) |
| Writing or reviewing a user story | `SRS.md` §9, the relevant feature only |
| Role or permission change | `docs/API_SPECIFICATION.md` §2.5, `SRS.md` §7 |
| New route, DTO, or validation rule | `docs/API_SPECIFICATION.md` (the endpoint's own §), then `packages/contracts/src/` |
| Schema change | the migration, then `finance_tracker_domain_database_design.md` |
| Architecture or sequence-flow question | `SDS.md` §4 |

`SRS.md` and `SDS.md` still describe the removed sharing layer in places; they are being
reconciled separately. **Where they disagree with the migration, the contract, or the API
specification, the latter three win** — and fix the narrative document rather than coding to it.

There is deliberately **no** `constitution.md`. An earlier version of this file pointed at one
that never existed, and the non-negotiables it was supposed to hold (technical principles,
business rules, access control, stack constraints) are all in this file. A fourth governing
document restating them is how that dangling reference happened in the first place.

---

## Part 2: Layout, Commands, Terminology

### Project Structure

One npm monorepo. The root `package.json` links `packages/*`, `api` and `mobile` as sibling
packages so `@sora/contracts` resolves from source with no publish step.

```text
finance/
├── packages/contracts/        # @sora/contracts — the shared contract (see below)
│   ├── src/
│   │   ├── enums.ts           # domain enums + roleSatisfies()/rankOf()
│   │   ├── money.ts           # MoneyString ↔ scaled bigint; never a JS number
│   │   ├── calc.ts            # every derived value (balance, spent, progress)
│   │   ├── schemas.ts         # Zod request validation
│   │   ├── responses.ts       # response DTOs, ERROR_CODES, ERROR_STATUS
│   │   └── routes.ts          # ROUTES + API_PREFIX, written once
│   └── test/                  # node --test, no runner dependency
├── server/                    # @sora/server — NestJS 11, ESM, Kysely
│   ├── src/
│   │   ├── config/            # env.ts validates every var at boot
│   │   ├── database/          # Kysely types, pool, SQL migration runner
│   │   ├── common/            # guards, interceptors, envelope, error mapping
│   │   ├── auth/  wallets/  accounts/  categories/
│   │   ├── transactions/  budgets/  goals/  dashboard/  audit/
│   │   └── main.ts
│   └── test/                  # node --test; boots the DI graph, no database
├── mobile/                    # @sora/mobile — Expo + React Native
│   └── src/                   # App.tsx, navigation, features, design tokens
├── db/
│   ├── migrations/            # raw SQL, forward-only, immutable once applied
│   └── tests/                 # psql constraint probes against a real Postgres
├── scripts/                   # check-contract-parity.mjs, migrate.mjs
├── .github/workflows/ci.yml   # contracts → database → server + mobile
├── docs/API_SPECIFICATION.md
├── SRS.md  SDS.md
├── finance_tracker_domain_database_design.md   # domain + schema rationale
├── finance_tracker_react_native_full_plan.md   # build plan and phase status
└── aif-sdlc-checklist.md                       # per-feature pre-merge gate
```

There is no `backend/` and no `frontend/`. Those were the FastAPI + Next.js implementation of
the removed sharing model; they were deleted in the pivot. Nothing should reference them.

### Dev Commands

The documented, always-available path is local Postgres and npm (rule 10) — a compose file existed
for the deleted stack and was removed rather than rewritten (see the README). The root
`docker-compose.yml` and `server/Dockerfile` are an **optional** addition on top of that, covering
only `server/` and Postgres (`docker compose up -d`, needs `JWT_SECRET`/`GOOGLE_CLIENT_ID` set in
`.env` first) — not `mobile/` (needs LAN/USB device access) and not the parked `webpage/`.
Postgres's container defaults to host port 5433, not 5432, so it can run alongside the host
Postgres this section describes rather than colliding with it. Debugging either container: plain
`docker logs <container>` runs through rtk's `docker` filter and can summarize, so use
`rtk proxy docker logs <container> --tail N` for the full unfiltered output.

```bash
npm install                                   # root; links every package

npm run build -w @sora/contracts           # contracts must build before the API typechecks
npm test                                      # every package that defines a test script
npm test -w @sora/contracts                # money/derivation math, 61 tests
npm test -w @sora/server                   # asserts every ROUTES path is mounted
npm run typecheck                             # every package

node scripts/check-contract-parity.mjs        # contract ↔ schema ↔ API spec agreement

npm run db:migrate                            # apply db/migrations/*.sql in order
npm run db:test                               # apply, then run db/tests/*.sql probes
# By hand, and the fallback while the runner is being written:
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f db/migrations/001_initial_wallet_schema.sql

npm run setup                                 # install + build contracts + migrate, one shot
npm run dev:server                            # server: build, then watch + auto-restart
npm run dev:mobile                            # mobile: expo start
npm run dev                                   # both together
# One-shot, no watch:
npm run build -w @sora/server && npm start -w @sora/server
```

CI (`.github/workflows/ci.yml`) runs contracts alone first, then the migrations against a real
PostgreSQL 17 — applied, probed, then applied **again** to prove idempotence — then server and
mobile in parallel. Passing migrations only prove the DDL parses; `db/tests/*.sql` is what
proves the rules are enforced, which is why both run.

### Service URLs

| | |
|---|---|
| API | `http://localhost:3001` (`.env.example`'s `PORT`) |
| Expo dev server | `http://localhost:8081` |
| Database | `postgresql://<user>:<pass>@localhost:5432/<db>` via `DATABASE_URL` |
| API (Docker) | `http://localhost:3001` (`API_HOST_PORT`) |
| Database (Docker) | `postgresql://<user>:<pass>@localhost:5433/<db>` (`POSTGRES_HOST_PORT`) |

`.env.example` and `server/src/config/env.ts` currently disagree on several variable names
(`API_PORT` vs `PORT`, `JWT_ACCESS_TTL` vs `ACCESS_TOKEN_TTL_SECONDS`). **`env.ts` is what is
actually read** — it validates at boot and refuses to start on a bad value. Fix the example
against it, never the reverse.

There is no Swagger UI: the API specification is hand-written and reviewed, because the parts
that matter here (the 404-not-403 rule, cross-wallet role requirements, side effects) are not
derivable from decorators.

### Business Terminology

One term per concept, identical in code, SQL, API, and UI.

| Term | Not | Note |
|---|---|---|
| **Wallet** | Household, Family, Group | One *person's* finances: "Tam's Wallet", "Mom's Wallet". `owner_user_id` → `users`. The wallet **is** the sharing boundary; there is no layer above it and no wallet "type" |
| **Member** | Participant, Collaborator | A `wallet_members` row: another real user holding `OWNER`/`EDITOR`/`VIEWER` on a wallet, plus a `relationLabel` ("Girlfriend", "Mom") |
| **Account** | Sub-wallet | Where a wallet's money sits — Vietcombank VND, Cash, MoMo, Visa. Belongs to exactly one wallet |
| **Transaction** | Entry, Record | `INCOME`, `EXPENSE`, `TRANSFER`. Hangs off *accounts*, never off a wallet |
| **Budget** | Limit, Allowance | Planned spend for one category over one window |
| **Saving Goal** | Target, Objective | Target amount, optional deadline, funded by contributions |

**Wallet and Account both exist, at different levels.** An earlier version of this file said
"Account, not Wallet — wallet is not a separate entity". That rule is inverted now: Wallet is
*whose* money, Account is *where* it sits, and collapsing them loses the person boundary the
whole product is built on.

Field naming: `camelCase` on the wire and in the app, `snake_case` in SQL. The mapping is
mechanical and lives in the Kysely layer — no other translation table.

---

## Part 3: Business Rules

**BR-01 — Wallet ownership and membership.**
Every wallet has exactly one `ACTIVE` `OWNER` row, enforced by the partial unique index
`uq_wallet_single_owner` rather than by service code: "the last owner left and nobody can
administer this wallet" is unrecoverable through any API path. A user may own many wallets and
be a member of many more. Removing a member sets `status = REVOKED`; the row stays, so
`transactions.created_by_user_id` still resolves to a name.

**BR-02 — Cross-wallet transfers are a core feature.**
A `TRANSFER` whose two accounts belong to *different* wallets is one transaction, and it is how
you record paying a partner back. It requires `EDITOR` or above on **both** wallets —
deliberately stricter than a same-wallet transfer, because it moves money across a person
boundary, and read access to someone's wallet must not let you push money into it.

> **This reverses the old BR-02**, which read "transfers between accounts in different [sharing
> containers] are not permitted". Do not reinstate it. Blocking cross-wallet transfers would
> force the settlement between two people to be recorded as two disconnected entries that
> nothing reconciles — which is the exact failure the wallet model exists to remove.

**BR-03 — Transaction immutability.**
`amount`, `type`, `fromAccountId` and `toAccountId` cannot be edited (`409
TRANSACTION_IMMUTABLE`). A recorded movement of money is a historical fact, and every balance,
budget figure and goal total is derived from it — rewriting one silently rewrites all of them.
Correcting a mistake is cancel + create, which leaves both rows visible. Only `description`,
`transactionDate`, `categoryId` and `reference` are mutable.

**BR-04 — Budget windows do not overlap.**
At most one `ACTIVE` budget per category per overlapping date range, enforced by the GIST
exclusion constraint `excl_budget_overlap`. Two windows can overlap without sharing an
endpoint, which no unique index can express. Archived budgets are excluded, so last August does
not block this August.

**BR-05 — Derived values are never stored.**
Account balance, wallet totals, budget `spent`/`remaining`/`usage`, and goal
`currentAmount`/`progress` are computed from transactions and contributions on every read.
There is no `spent_amount` column and no cached balance. A stored copy is a second source of
truth that will eventually disagree with the ledger, and the ledger is the one the bank agrees
with. The single implementation is `packages/contracts/src/calc.ts`.

**BR-06 — A transfer is neither income nor expense.**
Transfers are excluded from `income`, `expense`, `spendingByCategory` and budget `spent`
entirely, and reported as their own `transferredIn`/`transferredOut` figures. A wallet that
moved 2,000,000 from bank to cash has not earned or spent anything. This is the most
consequential rule in the product: get it wrong and every other number becomes untrustworthy.

**BR-07 — Currency consistency.**
An account has one currency; a transaction must match every account it names; a transfer
requires both accounts to share one. Wallet, account and dashboard totals are reported **per
currency and never summed across currencies** — adding a VND figure to a USD one produces a
number that is silently meaningless. Conversion is out of scope for v1.

**BR-08 — Invitations.**
Addressed to an **email**, so you can invite someone who has not signed up. Single-use,
SHA-256-hashed token (only the hash is stored), 7-day expiry, `EDITOR`/`VIEWER` only. `OWNER`
invites; the invitee's own email must match `invited_email` case-insensitively on accept, or the
token would be a bearer capability rather than an invitation to a person. At most one open
invitation per `(wallet, email)` — `uq_wallet_invitation_open` — so re-inviting revokes rather
than stacking live tokens.

---

## Part 4: Access Control

Role-based **per wallet**, resolved from `wallet_members` and compared through
`roleSatisfies()` in `packages/contracts/src/enums.ts`. There is no system-level admin role and
no per-row override: everything under a wallet inherits that wallet's role.

| Role | May |
|---|---|
| `OWNER` | Everything `EDITOR` may, plus membership, roles, ownership transfer, archive, audit log |
| `EDITOR` | Create and edit accounts, categories, transactions, budgets, goals, contributions |
| `VIEWER` | Read only — including who else can see this wallet |

**AC-01 — No membership row means `404`, not `403`.**
For any wallet-scoped resource, a caller with no membership gets `404`. `403` would confirm the
resource exists, which leaks whether a given wallet or account id is real to someone with no
access to it. `403` is reserved for "membership is established but the role is too low" — the
distinction is the whole point, so do not collapse the two.

**AC-02 — The API enforces authorization; the app only reflects it.**
Every guard runs server-side. Hiding a button is a UX affordance, never a control — the same
request can be made by hand.

**AC-03 — Cross-wallet writes are checked on every wallet involved.**
A transaction naming accounts in two wallets requires `EDITOR` on both (BR-02). Check each
wallet the request touches, not just the one in the path.

**AC-04 — Audit log is `OWNER`-only and append-only.**
No update or delete path is exposed on any route.

**AC-05 — Denials are logged.**
Every `401` and `403` at `WARN` with actor, resolved role, and target.

---

## Part 5: Standards

### The Shared Contract

**`@sora/contracts` is the single source for everything both sides must agree on** — enum
members, Zod validation, response shapes, error codes, route paths, and all money and
derivation math. The API imports it and the app imports it; **neither redefines any of it**. A
second copy of a rule is a rule that will diverge, and the divergence surfaces as a `500` from
Postgres or as two screens showing different balances.

`node scripts/check-contract-parity.mjs` proves it mechanically rather than by review: every
enum tuple against the `CHECK` constraint that admits it, every route against the API
specification, every error code against its status mapping. It reads the migration as text, so
it needs no database and runs in CI. Run it after touching any enum, route, or constraint.

### API Design

**API-01** — Versioned under `/api/v1/**` (`API_PREFIX`). Paths are kebab-case plural resource
names; paths come from `ROUTES`, never a literal string.

**API-02** — Every response, success or failure, is wrapped in `ApiEnvelope<T>`:
`{ success, message?, data, meta }`, with `meta.pagination` on list endpoints only.

**API-03** — Status mapping is in `docs/API_SPECIFICATION.md` §2.6. Note `410` (expired
invitation) and the `403`/`404` distinction in AC-01.

**API-04** — Error codes are `UPPER_SNAKE_CASE`, resource-prefixed, and defined **once** in
`ERROR_CODES` with a status in `ERROR_STATUS`. Do not invent a code at a call site.

**API-05** — Pagination `?page&pageSize`, default 25, max 200. Every list endpoint paginates;
an unbounded query is a defect.

**API-06** — `?sortBy=-transactionDate,amount` — leading `-` descending, comma-separated.

### Naming Conventions

**NC-01** — Entities `PascalCase` singular (`Transaction`, `WalletMember`). Request schemas
`createXSchema`/`updateXSchema`; response types `XResponse`. DTO fields `camelCase`.

**NC-02** — Tables `snake_case` plural; columns `snake_case`; PK `id` (UUID, `gen_random_uuid()`);
FKs `<entity>_id`. Constraint prefixes are load-bearing because the parity check reads them:
`chk_`, `uq_`, `idx_`, `excl_`.

**NC-03** — Resource paths `/wallets/{id}/members`; actions are a `POST` sub-path
(`/transactions/{id}/cancel`, `/wallets/{id}/transfer-ownership`).

**NC-04 — React Native `testID`, not element IDs.**
There is no DOM here; `testID` is the only stable selector Detox and React Native Testing
Library can address, and an unset one leaves a component reachable only by its visible text,
which breaks on any copy change or translation.

| Element | Pattern | Example |
|---|---|---|
| Screen root | `screen-[name]` | `screen-transactions` |
| Form field | `input-[entity]-[field]` | `input-transaction-amount` |
| Submit button | `btn-submit-[entity]` | `btn-submit-transaction` |
| Open create form | `btn-add-[entity]` | `btn-add-transaction` |
| Row action | `btn-[action]-[entity]` | `btn-edit-category` |
| List container | `list-[entity]` | `list-transactions` |
| List row | `row-[entity]-[id]` | `row-transaction-<uuid>` |
| Picker | `picker-[entity]` | `picker-wallet` |
| Bottom sheet / modal | `sheet-[entity]` | `sheet-transaction` |

### Mobile Conventions

**MB-01** — TypeScript only, `strict`, no `any` without a comment saying why.

**MB-02** — Server state is TanStack Query; UI state is Zustand. Do not mirror API data into
Zustand — two caches of the same money is BR-05 repeated in the client.

**MB-03** — Forms are React Hook Form + the Zod schema from `@sora/contracts`. The app does
not author its own validation rules.

**MB-04** — Tokens live in `expo-secure-store` (Keychain / Keystore), never
`AsyncStorage`.

**MB-05** — Icons from `lucide-react-native`. No custom SVGs without a reason.

**MB-06** — Dark mode is the default; light is the toggle. Colours come from design tokens, not
literals.

**MB-07** — Every screen handles loading, empty, error and success. An unhandled empty state is
an incomplete screen.

**MB-08** — Money is rendered through `formatMoney`/`formatMoneyCompact`. Never
`Number(amount)`, never `toLocaleString` on a raw string.

### Validation

**VL-01** — The API is the source of truth. The app validates for feedback only, using the same
schema, so the two cannot disagree.

**VL-02** — Uniqueness is enforced at the database (`uq_*`), checked in the service for a clean
`409`, and surfaced in the UI. The index is the guarantee; the service check is the error
message.

**VL-03** — A request referencing another entity verifies it exists and is in a usable state:
`404` when missing or not visible, `409` when archived or already cancelled.

**VL-04 — Amounts.** Positive, non-zero, `DECIMAL(19,4)`, transported as strings, compared and
summed as scaled `bigint`. Direction comes from `type` plus which account side is set, never
from a sign on `amount`. `initialBalance` is the one signed amount — a credit card opens
negative.

### Logging & Audit

**LA-01** — Never logged: passwords, password hashes, access/refresh tokens, invitation tokens.
User ids and emails may appear at `INFO`.

**LA-02** — Financial mutations and every membership/role change write an `audit_logs` row:
`event`, `entity_type`, `entity_id`, `result` (`SUCCESS`/`DENIED`/`FAILURE`), `actor_id`,
`actor_role`, `note`, `ip`. A cross-wallet transfer is audited **once against each wallet**, so
it appears in both trails — each side genuinely had money move.

**LA-03** — `401` and `403` at `WARN` with actor, role and target (AC-05).

**LA-04** — `/health` is never logged: probe traffic would bury the audit trail.

### Definition of Done

A feature is done when all seven hold. The item-by-item form, with the commands, is
[`aif-sdlc-checklist.md`](aif-sdlc-checklist.md) — that file expands these gates rather than
restating them.

1. **Traceable** — to an `SRS.md` user story and an endpoint in `docs/API_SPECIFICATION.md`.
2. **Contract-first** — schemas, response types and error codes live in `@sora/contracts`,
   and `check-contract-parity.mjs` passes.
3. **Authorized** — minimum role enforced server-side, AC-01 honoured (`404` for non-members),
   audit row written.
4. **Validated** — Zod at the edge, service checks for what needs a lookup, database constraint
   as the backstop that holds for any writer.
5. **Derived, not stored** — no new column caching a computed figure (BR-05).
6. **Tested** — happy path, each documented error, and the role matrix including the
   `404`-vs-`403` boundary.
7. **Specs updated** — the API specification, the design doc, and the plan's phase checkboxes
   reflect what was actually built.

---

## Part 6: Technology Stack

**Shared** — `@sora/contracts`: TypeScript 5.7, Zod 3, `node --test`. No runtime dependency
beyond Zod, so the app bundles it without pulling server code in.

**API** — Node 22+, NestJS 11, TypeScript ESM (`NodeNext`, `.ts` specifiers rewritten on emit),
`kysely` + `pg` for typed SQL, raw SQL migrations, Zod validation from the shared contract,
Argon2id password hashing, `jsonwebtoken` for HS256 access tokens (15 min) plus rotating
refresh tokens (7 days, hashes only stored), PostgreSQL 17.

No ORM and no query builder beyond Kysely: every aggregate the dashboard and balance
derivations need is SQL, and an ORM's abstraction over `GROUP BY` costs more than it saves here.

**Mobile** — Expo, React Native, TypeScript, React Navigation, TanStack Query, Zustand, React
Hook Form + Zod, `expo-secure-store`, `lucide-react-native`, dark mode default.

**Local environment** — PostgreSQL 17 installed on the host, npm; no container runtime in the
documented workflow (rule 10). `docker-compose.yml`/`server/Dockerfile` at the repo root are an
optional alternative for `server/` + Postgres, not a replacement for this path.

### Configuration

`server/src/config/env.ts` validates the whole environment once at boot and refuses to start on
anything missing or unusable — a `JWT_SECRET` that reads as configured but is 8 characters
authenticates nothing while looking fine.

`DATABASE_URL`, `DATABASE_POOL_MAX`, `JWT_SECRET` (≥32 chars), `JWT_ISSUER`,
`ACCESS_TOKEN_TTL_SECONDS` (900), `REFRESH_TOKEN_TTL_DAYS` (7), `INVITATION_TTL_DAYS` (7),
`AUTH_RATE_LIMIT_PER_MINUTE` (10), `LOGIN_FAILURE_LIMIT` (5), `LOGIN_LOCKOUT_MINUTES` (15),
`PORT`, `NODE_ENV`, `APP_VERSION`, `MIGRATIONS_DIR`.

The local `.env` still carries variables from the deleted stack (SMTP, exchange-rate provider,
`NEXT_PUBLIC_*`). Nothing reads them. Add a variable to `env.ts` first — a value present only in
`.env` or `.env.example` is not configuration, it is a comment.

### Data Safety

This is financial data. A destroyed transaction row does not just lose a record — it silently
rewrites every balance, budget figure and goal total derived from it, and nothing in the app
will report that the answers changed.

**Never invoke any command that could reset, drop, or corrupt a database.** Specifically:
`DROP DATABASE` / `DROP SCHEMA`, `TRUNCATE`, a `DELETE` or `UPDATE` with no `WHERE`,
`node scripts/migrate.mjs --reset` against anything that is not a disposable database, or
restoring a dump over existing data. This holds even while debugging, "fixing" a stuck state, or
re-running a migration — **ask first**.

`scripts/migrate.mjs --reset` already refuses any database whose name does not match
`dev|test|local|check|scratch|ci` unless `ALLOW_DESTRUCTIVE_RESET=yes` is set. That guard exists
because `--reset` is one keystroke from `--status` and destroys everything; **do not remove or
loosen it**, and do not set the override to get past it on a database you did not create for the
purpose.

**Applied migrations are immutable.** `scripts/migrate.mjs` records a checksum per file and
refuses to run when an applied file's contents have changed — the database no longer matches the
file, and only a human knows whether the fix is a new migration or a restore. Add a new
migration; never edit an old one.

Synthetic test data is cleaned up by its own obviously-fake identifier only (an email like
`probe+<uuid>@example.invalid`, a wallet named `scratch-...`), never by an unfiltered statement
and never by "everything created today".

Nothing financial is hard-deleted by design: wallets, accounts, categories and budgets are
archived, transactions are cancelled, members are revoked. Don't add a hard-delete path.

### Security Requirements

- No secrets in source. `.env` is gitignored; `.env.example` carries names and no values.
- Argon2id for passwords. Length-only policy (12–200), no composition rules — those measurably
  push users toward predictable substitutions (NIST SP 800-63B).
- Access tokens 15 min; refresh tokens 7 days, single-use, rotated, **hash-only** storage so a
  database read cannot mint a session. A replayed (already-revoked) refresh token revokes the
  user's entire token family: replay means the token was stolen, and ending every session is
  the safe answer.
- Identical `401 CREDENTIALS_INVALID` for unknown email and wrong password, so login cannot
  enumerate registered addresses.
- Rate limits on `/auth/login`, `/auth/register`, `/auth/refresh`, plus per-email lockout.
- Parameterized SQL only. Kysely parameterizes; a hand-built `sql` template must too.
- Invitation `invitedEmail` is masked in the public preview response.

---

## Part 7: Rules Learned From Past Bugs

Each entry exists to stop one specific bug from being reintroduced. Add to it rather than
rewriting it.

1. **Money is never a JS number.** Amounts cross the wire as strings and are computed as scaled
   `bigint` through `packages/contracts/src/money.ts`. `DECIMAL(19,4)` reaches
   `999999999999999.9999`, past the `2^53` boundary where float64 stops representing integers
   exactly; and inside that range float cannot represent `0.1 + 0.2` either. Measured on this
   Node: `0.1 + 0.2 === 0.30000000000000004`, and adding `0.01` a hundred times yields
   `1.0000000000000007` — a balance wrong by an amount nobody can trace back to a cause, which
   is worse than a crash. `parseMoney` therefore **rejects** more than 4 decimals rather than
   rounding: silently dropping a digit a user typed is data loss that only surfaces much later
   as a balance that will not reconcile.

   The driver is the easy half to miss: `node-postgres` parses `NUMERIC` (OID 1700) and `INT8`
   (OID 20) into JS numbers by default, silently rounding every amount it *reads* even when the
   write path is perfect. `server/src/database/pg-types.ts` overrides both to return text. Never
   `Number(amount)`, and never remove those type parsers.

2. **A `403` for a non-member leaks existence.** A caller with no membership row on a wallet gets
   **404**; `403` is only for "member, but role too low" (AC-01). A `403` confirms that a given
   wallet or account id is real to someone with no access to it. This is the kind of thing a
   well-meaning refactor reintroduces while tidying up error handling, which is why it is
   written into the design at schema level and not just in a guard.

3. **`uq_wallet_single_owner` is a real partial unique index, so ownership transfer must demote
   before it promotes.** Two `ACTIVE` owners are rejected even momentarily, so the intuitive
   promote-then-demote order fails outright. Do both inside one transaction, taking
   `SELECT ... FOR UPDATE` on the wallet's membership rows first — the lock turns a concurrent
   double-promote into a clean serialised outcome instead of a constraint violation.

4. **Business rules belong in the database, not only the service layer.** The API is not the only
   writer: a migration, a backfill script, or a `psql` session bypasses every service check. The
   `CHECK` constraints, the partial unique indexes and the GIST budget-overlap exclusion are
   load-bearing, and `db/tests/001_constraints.sql` probes each one to prove it rejects what it
   should. This is also why the stack is `kysely` + raw SQL migrations rather than an ORM that
   re-derives DDL from models and would quietly drop the constraints it does not model.

5. **A budget overlap cannot be expressed as a unique index.** Two windows can overlap without
   sharing either endpoint, so `excl_budget_overlap` is a GIST exclusion constraint over
   `daterange(start_date, end_date, '[]')`. Reaching for a `UNIQUE (category_id, start_date)`
   here looks right and enforces almost nothing.

6. **An invitation is not a pending member row.** `wallet_members.status` is `ACTIVE`/`REVOKED`
   only. A `PENDING` member row would be addressed to an email with no `users` row yet, so
   `user_id` would have to be nullable — and `user_id` is the column every single access check
   joins on. Making it nullable to model an invite weakens the foreign key that authorizes every
   request, to save one table. Invitations live in `wallet_invitations`, keyed by email.

7. **`@sora/contracts` is the single source, and duplicating from it is the failure mode to
   watch for.** Enums, Zod schemas, response types, error codes, route paths and all
   money/derivation math are defined there once and imported by both `server/` and `mobile/`. A
   second copy diverges, and the divergence surfaces as a `500` from Postgres or as two screens
   showing different balances. `node scripts/check-contract-parity.mjs` proves agreement
   mechanically — enum tuples against the `CHECK` constraints in both directions, every error
   code against a status, every route against the API specification. Run it before calling any
   schema or contract change done.

8. **A `hashFiles()` condition at GitHub Actions *job* level always evaluates empty.** Job-level
   `if:` is evaluated before the repository is checked out, so `hashFiles()` has nothing to hash
   and a job guarded that way silently never runs — green CI that tested nothing. Guard at
   *step* level, after `actions/checkout`, or use `needs:` instead.

9. **A dangling reference in this file costs more than a missing document.** This file pointed at
   a `constitution.md` that never existed, so every session honouring the precedence order read
   nothing and proceeded anyway. It also claimed React + Vite + Redux when the frontend was
   Next.js with no Redux, and Alembic when the migrations were raw SQL. Documentation about a
   stack is only load-bearing if something checks it against the stack: prefer a mechanical
   check over a prose claim, and when a claim cannot be checked mechanically, verify it before
   writing it down.

10. **Never write an instruction whose only path requires a tool that may be absent.** The
    documented workflow is local PostgreSQL 17 + npm precisely so it does not depend on a
    container runtime — a throwaway cluster via `initdb`/`pg_ctl` on a non-default port is the
    fallback for verification. If a container runtime happens to be available in a given shell,
    it is still not the documented path, and a doc that assumes it strands anyone without it.

11. **Comments explain *why*, never *what*.** Before commenting, make the code self-documenting
    instead — a descriptive name or an extracted, well-named helper. Only comment when the
    reasoning genuinely is not visible in the code: a business constraint, why a workaround was
    chosen over the "correct" approach, a non-obvious side effect or performance risk, an
    external reference, or an assumption the caller must uphold. A comment that restates the
    line above it is noise — delete it. Keep comments in sync during refactors: if a comment
    would be wrong after your change, fix or remove it in the same edit rather than leaving
    stale rationale attached to different logic. Delete dead code outright instead of commenting
    it out — git history is the record. `TODO`/`FIXME` must point at something concrete (a
    `verifications/` doc, an issue link); a bare `TODO` with no tracking reference is worse than
    no comment at all. **Never write a comment as a debug journal.** Don't narrate the
    investigation, the bug's symptom history, or a fix's before/after reasoning in prose inside
    the code — that belongs in the commit message or a `verifications/` report. One or two
    lines, why-only; if it needs more than that, the code needs a better name or an extraction,
    not more comment.

12. **No AI-authorship lines anywhere.** See Git above. No "Generated with", no
    `Co-Authored-By: Claude`, no model names — not in commit messages, PR bodies, code comments,
    or docs.
