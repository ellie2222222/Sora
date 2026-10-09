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
| `comment-audit` | Comment-only sweep: removes "what" comments, stale rationale, commented-out code, untracked `TODO`s, and adds a missing "why" where non-obvious code has none. Never changes logic |
| `restructure` | Where files live: misplaced or orphaned files, naming drift, layout that no longer matches the documented architecture |
| `extract-modules` | Splits code out of screens into dedicated files — duplicated/oversized inline components, label maps, shared types, pure helpers, hooks — and re-points callers |
| `i18n-audit` | Translation catalog: orphaned/missing keys, parity across every locale and untranslated copies, drifted `defaultValue`s, hardcoded UI text |
| `readability-audit` | Text too small for its tone: muted/faint text below its size floor (`docs/DESIGN_GUIDELINES.md` "Type size and tone"), opacity on quiet text, text allowed to shrink. Run on UI before calling it done |
| `scratch-probe` | Runs a changed server path against a disposable Postgres + freshly built API with probe data, then tears down by exact name |
| `infra-audit` | Whether the system's design and operational posture still fit its scale — distinct from `double-check` (bugs in what exists) |
| `brainstorm-features` | Feature suggestions grounded in this repo's actual current patterns, discovered live |
| `skill-audit` | Audits the skill files themselves — frozen path references, trigger collisions, advice with no observable check |

`AGENTS.md`, `.agents/rules/` and `.codex/` (MCP config, hooks, command rules) port this file for Codex and
Google Antigravity; amend them in the same change when a rule here changes. Codex reads skills from
`.agents/skills/`, a copy of the eleven skills above: edit them here, then `npm run agents:sync` (CI runs
`npm run agents:check`).

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

For anything spanning more than the single arrow-chain above — several files, several
endpoints, a cross-package change — keep a running checklist of concrete, verifiable steps
instead of holding the plan in your head, checking an item off only once it's actually done. If
something learned mid-implementation invalidates the plan itself, revise the plan first, then
the checklist to match, before continuing. This tracks progress through the work; it doesn't
replace Part 5's Definition of Done, which is the gate for calling it finished.

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

**Verify the target before running anything destructive, not just the command.** This repo can
have more than one instance of the same kind of resource reachable at once — a host-installed
Postgres alongside the optional Docker Postgres (different ports, `docker-compose.yml`'s
`POSTGRES_HOST_PORT`/`DATABASE_URL` can point at either one and disagree with each other after a
`.env` edit that hasn't taken effect yet), local branches alongside remotes, a container that
looks like this project's but isn't (a stale/differently-named one from another project entirely).
Read back the actual connection string, container name, or remote a command is about to run
against — don't infer it from what it was earlier in the session or from what it's *supposed* to
be per `.env`. A destructive or mutating command aimed at the wrong instance is exactly as costly
as one aimed at the right instance without permission, and this repo's own multi-Postgres setup
(Part 6 → Technology Stack → Local environment) is precisely the shape of situation where that
mistake is easy to make. If a command surfaces a resource unrelated to the current task — an
unfamiliar database, an unrelated container, a different project's data — say so and ask; that is
never itself permission to inspect further, let alone modify it.

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
| 1 | [`db/migrations/001_schema.sql`](db/migrations/001_schema.sql) | The schema. What the database actually permits |
| 2 | [`packages/contracts/src/`](packages/contracts/src/) | Enums, validation, response shapes, error codes, route paths, money/derivation math |
| 3 | [`docs/API_SPECIFICATION.md`](docs/API_SPECIFICATION.md) | The endpoint contract: auth, authorization, validation, errors, side effects per endpoint |
| 4 | [`SRS.md`](SRS.md) | What the system does and why — domain model, business flows, user stories |
| 5 | [`SDS.md`](SDS.md) | How it is designed — architecture, sequence flows, feature mapping |

Read only the section a change actually touches; these documents are large.

| Trigger | Read |
|---|---|
| Adding or renaming a domain entity | `SRS.md` §2 (CDM), then §4 (business rules) |
| Writing or reviewing a user story | `SRS.md` §9, the relevant feature only |
| Role or permission change | `docs/API_SPECIFICATION.md` §2.5, `SRS.md` §7 |
| New route, DTO, or validation rule | `docs/API_SPECIFICATION.md` (the endpoint's own §), then `packages/contracts/src/` |
| Schema change | the migration, then `plans/architecture/domain-database-design.md` |
| Architecture or sequence-flow question | `SDS.md` §4 |

**Where SRS.md or SDS.md disagree with the migration, the contract, or the API
specification, the latter three win** — and fix the narrative document rather than coding to it.

There is deliberately **no** `constitution.md`. An earlier version of this file pointed at one
that never existed, and the non-negotiables it was supposed to hold (technical principles,
business rules, access control, stack constraints) are all in this file. A fourth governing
document restating them is how that dangling reference happened in the first place.

---

## Part 2: Layout, Commands, Terminology

### Project Structure

One npm monorepo. The root `package.json` links `packages/*`, `server` and `mobile` as sibling
packages so `@sora/contracts` resolves from source with no publish step.

```text
sora/
├── packages/contracts/        # @sora/contracts — the shared contract (see below)
│   ├── src/
│   │   ├── enums.ts           # domain enums + roleSatisfies()/rankOf()
│   │   ├── money.ts           # MoneyString ↔ scaled bigint; never a JS number
│   │   ├── calendar.ts        # instant + wallet time zone → calendar day; the only such conversion
│   │   ├── calc.ts            # every derived value (balance, spent, progress)
│   │   ├── schemas.ts         # Zod request validation
│   │   ├── responses.ts       # response DTOs, ERROR_CODES, ERROR_STATUS
│   │   ├── routes.ts          # ROUTES + API_PREFIX, written once
│   │   └── starter-categories.ts  # default categories seeded into a new wallet
│   └── test/                  # node --test, no runner dependency
├── server/                    # @sora/server — NestJS 12, ESM, Kysely
│   ├── Dockerfile             # optional image, built from the repo root
│   ├── src/
│   │   ├── config/            # env.ts validates every var at boot
│   │   ├── database/          # Kysely types, pool, pg type parsers
│   │   ├── common/            # guards, interceptors, envelope, error mapping
│   │   ├── auth/  wallets/  accounts/  categories/
│   │   ├── transactions/  budgets/  goals/  dashboard/  audit/
│   │   ├── ai/  exchange-rate/  health/
│   │   └── main.ts
│   └── test/                  # node --test; unit tests boot the DI graph, integration.*.test.ts also a real Postgres
├── mobile/                    # @sora/mobile — Expo + React Native
│   ├── app.config.js           # app.json plus GWP-ASan off for every build; SORA_E2E_BUILD=1 also allows cleartext
│   ├── e2e/                    # Maestro flows, API seed and helper scripts (see its README)
│   └── src/
│       ├── App.tsx
│       ├── app/                # config/, i18n/, navigation/, providers/, store/ (Redux Toolkit + RTK Query)
│       ├── features/           # one directory per domain feature, each with its own barrel
│       ├── components/         # shared UI primitives, barrel-exported
│       ├── design-system/      # colors, spacing, radius, sizes, shadows, typography tokens
│       ├── services/           # api/, auth/, guest/ (local-first guest mode), haptics/, locale/ (the app language outside React), storage/, sync/ (offline queue, per-account read cache)
│       └── hooks/  utils/
├── db/
│   ├── migrations/            # raw SQL, forward-only, immutable once applied
│   └── tests/                 # psql constraint probes against a real Postgres
├── scripts/                   # migrate.mjs (migration runner), check-contract-parity.mjs, sync-agent-skills.mjs, audit-runtime-deps.mjs,
│                              # seed/ (demo data through the API, plans/tooling/seed-data-plan.md)
├── .github/                   # workflows/ci.yml (contracts + database → server; contracts → mobile; server + mobile → e2e; audit standalone), dependabot.yml
├── docs/
│   ├── API_SPECIFICATION.md
│   ├── DESIGN_GUIDELINES.md   # product principles, loading/empty/error states, visual tokens (MB-11)
│   ├── ERROR_CODES.md  LOCALIZED_DEFAULTS_RULE.md
│   ├── DEVICE_NETWORKING.md   # reaching the API from an emulator or phone, per network and API host
│   └── test-plans/            # per-feature test plans: SRS §9 story → test case → test file:line
├── plans/
│   ├── README.md
│   ├── architecture/          # domain-database-design.md, multi-currency-plan.md, exchange-rate-resilience-plan.md,
│   │                          # ai-chat-assistant-plan.md, dashboard-current-state.md, dashboard-feature-roadmap.md,
│   │                          # timezone.md (brief) + wallet-timezone-plan.md
│   ├── mobile/                # offline-sync-plan.md (offline mutation queue), e2e-framework-decision.md, transaction-ui-plan.md
│   └── tooling/               # seed-data-plan.md (realistic seed data through the API, scripts/seed/)
├── verifications/             # verification/audit reports, YYYY-MM-DD-short-slug.md
├── webpage/                   # parked; not part of the build, CI or compose
├── .claude/skills/  .agents/  .codex/   # canonical skills; Codex/Antigravity ports (see Project Skills)
├── docker-compose.yml         # optional server/ + Postgres stack
├── SRS.md  SDS.md  RUNBOOK.md  AGENTS.md
└── aif-sdlc-checklist.md      # per-feature pre-merge gate
```

There is no `backend/` and no `frontend/`. Those were the FastAPI + Next.js implementation of
the removed sharing model; they were deleted in the pivot. Nothing should reference them.

### Dev Commands

The documented, always-available path is local Postgres and npm (rule 10) — a compose file existed
for the deleted stack and was removed rather than rewritten (see the README). The root
`docker-compose.yml` and `server/Dockerfile` are an **optional** addition on top of that, covering
only `server/` and Postgres (`docker compose up -d --build`, needs `JWT_SECRET`/`GOOGLE_CLIENT_ID`
set in `.env` first; a one-shot `migrate` service applies `db/migrations` before `server` starts,
and pgAdmin/Adminer are opt-in via `--profile gui`) — not `mobile/` (needs LAN/USB device access)
and not the parked `webpage/`.
Postgres's container defaults to host port 5432 — the same port the host Postgres above uses —
so override `POSTGRES_HOST_PORT` in `.env` before bringing this stack up if a host Postgres is
already running, or the two will collide. Debugging either container: plain
`docker logs <container>` runs through rtk's `docker` filter and can summarize, so use
`rtk proxy docker logs <container> --tail N` for the full unfiltered output.

```bash
npm install                                   # root; links every package

npm run build -w @sora/contracts           # emits dist/ only: server and mobile resolve its src/ via package exports
npm test                                      # every package that defines a test script
npm test -w @sora/contracts                # money/derivation math and schemas
npm test -w @sora/server                   # asserts every ROUTES path is mounted
npm run typecheck                             # every package

node scripts/check-contract-parity.mjs        # contract ↔ schema ↔ API spec agreement

npm run db:migrate                            # apply db/migrations/*.sql in order
npm run db:test                               # apply, then run db/tests/*.sql probes
npm run db:seed                               # demo data through a running API (SEED_API_URL); --dry-run needs none

npm run setup                                 # install + build contracts + migrate, one shot
npm run dev:server                            # server: build, then watch + auto-restart
npm run dev:mobile                            # mobile: expo start
npm run dev:mobile:clear                      # mobile, Metro cache cleared (stale bundle after an edit)
npm run dev                                   # both together
# One-shot, no watch:
npm run build -w @sora/server && npm start -w @sora/server

# E2E (Maestro, Android emulator, disposable database): steps in mobile/e2e/README.md
maestro test mobile/e2e -e E2E_API_BASE=… -e E2E_EMAIL=… -e E2E_PASSWORD=… -e E2E_WALLET_ID=…
```

CI (`.github/workflows/ci.yml`) runs contracts and the database job in parallel; the database job
applies the migrations against a real PostgreSQL 17, probes them, then applies them **again** to
prove idempotence. Server waits on both; mobile needs only contracts. The dependency audit is its
own job that nothing waits on. Passing migrations only prove the DDL parses; `db/tests/*.sql` is what
proves the rules are enforced, which is why both run. Last, `e2e` (after server and mobile) builds
the E2E APK and runs `mobile/e2e` on an Android emulator against the API on its own database.

### Service URLs

| | |
|---|---|
| API | `http://localhost:3000` (`.env.example`'s `PORT`) |
| Expo dev server | `http://localhost:8081` |
| Database | `postgresql://<user>:<pass>@localhost:5432/<db>` via `DATABASE_URL` |
| API (Docker) | `http://localhost:3000` (`API_HOST_PORT`) |
| Database (Docker) | `postgresql://<user>:<pass>@localhost:5432/<db>` (`POSTGRES_HOST_PORT`) |

**`server/src/config/env.ts` is what is actually read** — it validates at boot and refuses to
start on a bad value. `.env.example` mirrors its names; if the two ever disagree, fix the example
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
| **Budget** | Limit, Allowance | Planned spend for one category, one goal, or the whole wallet over one window |
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

**BR-03 — Transactions are editable in place.**
Every field a create sets can be edited, `amount`, `type` and both accounts included. An edit that
moves money is checked exactly as a create of the resulting row (shape, roles on every wallet named
before and after, currency, category, goal tag), audited against every wallet it touched, and
every balance, budget and goal figure follows on the next read (BR-05). A goal contribution the
transaction backs moves with it, and the payment must stay an expense from the goal's wallet.

**BR-04 — Budget windows do not overlap, and periodic budgets repeat.**
A `DAILY`/`WEEKLY`/`MONTHLY`/`YEARLY` budget repeats from its start date until it is deleted (no
end date, `chk_budget_end`); each read reports the period containing the day asked about
(`budgetWindow` in `calc.ts`). `CUSTOM` and `GOAL` cover a fixed window. At most one budget per
target over overlapping days, enforced by the GIST exclusion constraints `excl_budget_category_overlap`,
`excl_budget_goal_overlap` and `excl_budget_overall_overlap`; a repeating budget's
open end is unbounded, so it holds its target until deleted. Two windows can overlap without
sharing an endpoint, which no unique index can express. Budgets are deleted outright: a budget
only plans, and nothing is derived from it.

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
number that is silently meaningless. Conversion of a stored or authoritative figure — recording,
correcting, or retrying a transaction in a currency other than its own — is out of scope for v1.
The one exception is the dashboard's own optional, read-only, approximate total converted into a
display currency (`GET /dashboard?displayCurrency=`, `ExchangeRateService`,
`server/src/exchange-rate/`) — never stored, never summed into a balance/budget/goal figure, and
always marked with a freshness status (fresh/stale/unavailable). See SRS.md BR-16 and SDS.md §4.5.

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
(`/transactions/{id}/delete`, `/wallets/{id}/transfer-ownership`).

**NC-04 — React Native `testID`, not element IDs.**
There is no DOM here; `testID` is the only stable selector the E2E suite (Maestro, `id:`; see
`plans/mobile/e2e-framework-decision.md`) can address, and an unset one leaves a component
reachable only by its visible text, which breaks on any copy change or translation.

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
| Sheet's Cancel / Close | `btn-cancel-[entity]` | `btn-cancel-transaction` |
| Sheet's Back | `btn-back-[entity]` | `btn-back-wallet` |
| Picker option | `option-[entity]-[id]` | `option-category-<uuid>` |
| Segmented choice | `btn-[entity]-[field]-[value]` | `btn-transaction-type-EXPENSE` |
| Calculator keypad | `keypad-[entity]`; keys `-key-<label>`, submit `-key-confirm` | `keypad-transaction-key-confirm` |

`BottomSheetModal`'s `entity` prop sets all three sheet ids. Screens that stay mounted together (tabs, a
stack's lower screen) can share an id, so a flow checks its `screen-*` root before acting.

### Mobile Conventions

**MB-01** — TypeScript only, `strict`, no `any` without a comment saying why.

**MB-02** — Server state is Redux Toolkit's RTK Query (`mobile/src/app/store/api/*`, one
`apiSlice` per resource, wired through a custom `axiosBaseQuery` so the bearer-attach/refresh-on-401
axios interceptors stay the one implementation); UI-only state is plain Redux (`authSlice`,
`offlineQueueSlice`). Do not mirror API data into a plain Redux slice — two caches of the same
money is BR-05 repeated in the client. Neither `zustand` nor `@tanstack/react-query` is a
dependency of this app; do not add either or write code assuming it.

**MB-03** — Forms are React Hook Form + the Zod schema from `@sora/contracts`. The app does
not author its own validation rules.

**MB-04** — Tokens live in `expo-secure-store` (Keychain / Keystore), never
`AsyncStorage`.

**MB-05** — Icons from `lucide-react-native`. No custom SVGs without a reason.

**MB-06** — Dark mode is the default; light is the toggle. Colours, and every other static design
value (spacing, sizes, type, radius, borders, icon size and stroke, opacity, shadows), come from
`useTheme()` tokens, not literals. What may stay literal is listed under "Design tokens" in
`docs/DESIGN_GUIDELINES.md`; `mobile/src/design-system/tokens-usage.test.ts` enforces it.

**MB-07** — Every screen handles loading, empty, error and success. An unhandled empty state is
an incomplete screen.

**MB-08** — Money is rendered through the `<Money>` component, or `formatMoneyString`/`formatScaled`
(`mobile/src/utils/money.ts`) where a plain string is needed. Never `Number(amount)`, never
`toLocaleString` on a raw string. `formatMoney`/`formatMoneyCompact` in `@sora/contracts` produce a
wire `MoneyString`, not display text.

**MB-09** — Every locale in `LOCALES` (`en`, `vi`, `de`, `es`, `fr`, `hi`, `ja`, `ko`, `ru`, `zh`) is active
and maintained at full key parity with `en.ts`. A new or reworded key is translated into all ten in the same
change.

**MB-10** — Cross-directory imports go through the target's `@/...` barrel (`@/components`,
`@/features/<name>`, `@/services/<name>`, `@/app/<providers,store,navigation,i18n>`), never a deep
relative path reaching into another directory's internals. A file importing a sibling inside its own
directory uses a direct relative path instead, never its own barrel. The one exception is a file that
is itself an orchestrator reaching broadly across many other modules (e.g. `ModalProvider.tsx`) — it
imports those specific deep paths directly and is excluded from its own directory's barrel, precisely
to avoid the require-cycle shape rule 14 in Part 7 describes.

**MB-11** — UI and state design follow [`docs/DESIGN_GUIDELINES.md`](docs/DESIGN_GUIDELINES.md)
(product principles, loading/empty/error architecture, visual tokens); run its Part 4 check before
calling UI work done.

### Validation

**VL-01** — The API is the source of truth. The app validates for feedback only, using the same
schema, so the two cannot disagree.

**VL-02** — Uniqueness is enforced at the database (`uq_*`), checked in the service for a clean
`409`, and surfaced in the UI. The index is the guarantee; the service check is the error
message.

**VL-03** — A request referencing another entity verifies it exists and is in a usable state:
`404` when missing or not visible, `409` when archived, cancelled, or deleted.

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

**Shared** — `@sora/contracts`: TypeScript 6.0, Zod 3, `node --test`. No runtime dependency
beyond Zod, so the app bundles it without pulling server code in.

**API** — Node 22.18+, NestJS 12, TypeScript ESM (`NodeNext`, `.ts` specifiers rewritten on emit),
`kysely` + `pg` for typed SQL, raw SQL migrations, Zod validation from the shared contract,
Argon2id password hashing, `jsonwebtoken` for HS256 access tokens (15 min) plus rotating
refresh tokens (7 days, hashes only stored), PostgreSQL 17.

No ORM and no query builder beyond Kysely: every aggregate the dashboard and balance
derivations need is SQL, and an ORM's abstraction over `GROUP BY` costs more than it saves here.

**Mobile** — Expo, React Native, TypeScript, React Navigation, Redux Toolkit + RTK Query, React
Hook Form + Zod, `expo-secure-store`, `lucide-react-native`, `react-native-reanimated` +
`react-native-gesture-handler` (a direct dependency; the app root is a `GestureHandlerRootView`),
dark mode default.

**Local environment** — PostgreSQL 17 installed on the host, npm; no container runtime in the
documented workflow (rule 10). `docker-compose.yml`/`server/Dockerfile` at the repo root are an
optional alternative for `server/` + Postgres, not a replacement for this path.

### Configuration

`server/src/config/env.ts` validates the whole environment once at boot and refuses to start on
anything missing or unusable — a `JWT_SECRET` that reads as configured but is 8 characters
authenticates nothing while looking fine.

`DATABASE_URL`, `DATABASE_POOL_MAX` (10), `DATABASE_STATEMENT_TIMEOUT_MS` (15000),
`DATABASE_CONNECTION_TIMEOUT_MS` (5000), `DATABASE_IDLE_TIMEOUT_MS` (30000), `JWT_SECRET`
(≥32 chars), `JWT_ISSUER`, `ACCESS_TOKEN_TTL_SECONDS` (900), `REFRESH_TOKEN_TTL_DAYS` (7),
`INVITATION_TTL_DAYS` (7), `AUTH_RATE_LIMIT_PER_MINUTE` (10), `LOGIN_FAILURE_LIMIT` (5),
`LOGIN_LOCKOUT_MINUTES` (15), `GOOGLE_CLIENT_ID`, `EXCHANGE_RATE_API_URL`,
`EXCHANGE_RATE_TIMEOUT_SECONDS` (5), `EXCHANGE_RATE_CACHE_TTL_MINUTES` (720), `CORS_ORIGINS`
(comma list; unset allows any origin outside production and none in it), `PORT`, `NODE_ENV`,
`APP_VERSION`.

The local `.env` may still carry variables from the deleted stack (SMTP, `NEXT_PUBLIC_*`).
Nothing reads them. Add a variable to `env.ts` first — a value present only in
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

**This repo can have more than one Postgres reachable at once, and they are not interchangeable.**
The documented host Postgres (Service URLs above, port 5432 by default) and the optional Docker
Postgres (`docker-compose.yml`, whatever `POSTGRES_HOST_PORT` currently resolves to in `.env`) are
separate databases that can each hold different data — one populated, one empty, one a stranger's
local instance entirely unrelated to this project. Before running anything that reads state to act
on or writes/deletes anything, confirm which instance the actual `DATABASE_URL` (or the connection
string a raw `psql`/`docker exec ... psql` call names) points at — don't assume it's "the" dev
database because a port number matches what it was last time, and don't infer it from `.env`'s
intent if a container hasn't actually been recreated since that file changed (`docker inspect`/
`docker port` show the truth, the file only shows intent). If a query surfaces a database that
isn't recognizably this project's (unfamiliar tables, unrelated data, a name that doesn't match
`sora_dev`/`sora_test`/etc.), stop and say so rather than continuing to query or, worse, mutate it.

**Applied migrations are immutable.** `scripts/migrate.mjs` records a checksum per file and
refuses to run when an applied file's contents have changed — the database no longer matches the
file, and only a human knows whether the fix is a new migration or a restore. Add a new
migration; never edit an old one.

Synthetic test data is cleaned up by its own obviously-fake identifier only (an email like
`probe+<uuid>@example.invalid`, a wallet named `scratch-...`), never by an unfiltered statement
and never by "everything created today".

Nothing financial is hard-*removed* by design: wallets, accounts and categories are archived,
transactions are marked `DELETED` (the row stays — only the status changes), members are revoked.
Two rows that nothing derived reads may be deleted: a category with no transactions and no budget
on it or any descendant (`DELETE /categories/{id}?mode=permanent`, spec §10.4), and a budget,
which only plans (`DELETE /budgets/{id}`, spec §12.5). Don't add a path that removes a ledger row
(transaction, account, contribution) outright.

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
   sharing either endpoint, so each `excl_budget_*_overlap` is a GIST exclusion constraint over
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

13. **All ten locales are maintained, and a language is one tuple.** `LOCALES` in `@sora/contracts`
    lists them; `SUPPORTED_LOCALES` in `mobile/src/app/i18n/index.ts` re-exports it, the
    `chk_user_locale`/`chk_category_translation_locale` constraints admit exactly it (the parity script
    checks), and `CATALOGS` in `locales/catalogs.ts` is typed `Record<Locale, LocaleResource>`, so a
    language added to the tuple without a catalog fails to compile. Every catalog is a `LocaleResource`:
    every key `en.ts` has, plus the extra plural forms its grammar needs. The eight non-en/vi files were
    once typed as a `DeepPartial` and left untouched while keys were added; they fell ~146 keys behind and
    their surviving strings went stale, some carrying another language's characters. `localeParity.test.ts`
    and `plurals.test.ts` now hold every catalog to `en.ts`'s keys, placeholders and each language's CLDR
    plural forms (Russian needs `_few`/`_many`, or most counts fall back to English).

14. **A barrel (`index.ts` re-exporting a directory) is an API boundary for outside callers, not a
    place to route every internal dependency through.** `mobile/src/**` uses per-directory barrels
    (`components/`, each `features/<name>/`, each `services/<name>/`, `app/<providers,store,
    navigation,i18n>/`) with the `@/` path alias (wired in both `tsconfig.json`'s `paths` and
    `metro.config.js`'s `resolver.extraNodeModules`, so it resolves at both typecheck and bundle
    time). The rule of thumb: a file importing something **outside its own directory** uses the
    target's `@/...` barrel; a file importing a sibling **inside its own directory** uses a direct
    relative path — never its own barrel. Getting this backwards produces a require cycle that is
    often invisible from any single file's imports, because it closes through two barrels rather
    than a direct back-reference: `A/index.ts → A/foo.ts → B/index.ts → B/bar.ts → A/index.ts`. This
    is exactly how `app/providers/index.ts` re-exporting `ModalProvider.tsx` broke: `ModalProvider`
    legitimately needs deep access to modal components in several `features/*` (an orchestrator, not
    a peer provider), and those modal components import `useTheme`/`AccountPicker`/etc. back through
    other barrels — closing a cycle through `app/providers/index.ts` for every feature it touched.
    The fix was never to stop using barrels; it was to have `ModalProvider.tsx` (and the api slices
    reaching into `services/sync`, which had the same shape of cycle with `app/store/index.ts`) import
    those specific cross-cutting dependencies by direct path, and to exclude `ModalProvider.tsx` from
    the `app/providers` barrel entirely since it is structurally an orchestrator, not a provider. A
    file that must reach broadly across many other modules is the one exception to the barrel rule,
    not a reason to abandon barrels generally. `import type` never contributes an edge here — type-only
    imports are erased at compile time, so two barrels referencing each other only in types is not a
    cycle. `useModal`/`ModalContext`/`ModalType`/`ModalParams` were later split out into their own
    `ModalContext.ts` (zero cross-feature imports) specifically so the barrel *could* re-export the
    hook — only `ModalProvider.tsx` itself, the orchestrator with the heavy imports, stays excluded
    and directly imported. The same split is the move whenever a provider's hook is lightweight but
    its implementation isn't: don't let the implementation's exclusion drag the hook out of the barrel
    with it.

15. **A `Pressable` (or any NativeWind-interop'd primitive) can never take a function as its `style`
    prop — not `style={(state) => ({...})}`, not `style={({ pressed }) => ({...})}` — under this
    project's NativeWind v4 / `react-native-css-interop` setup.** `react-native-css-interop`
    registers `cssInterop(Pressable, { className: "style" })` globally
    (`node_modules/react-native-css-interop/dist/runtime/components.js`) — this wraps **every**
    `Pressable` in the app via the custom JSX runtime (`jsxImportSource: "nativewind"` in
    `babel.config.js`), whether or not that element even has a `className`. That wrapper's config
    (`getNormalizeConfig` in `runtime/config.js`) always sets `inlineProp = "style"` for a plain
    `{ className: "style" }` mapping, so `getDeclarations` in `runtime/native/native-interop.js`
    unconditionally runs whatever is in the `style` prop through `collectInlineRules` →
    `getOpaqueStyles`, treating it as a static value to spread. A function has no own enumerable
    properties, so `{...styleFn}` silently evaluates to `{}` — the entire function, and everything
    it would have returned (background, border, radius, padding, the works), is discarded and
    replaced with an empty object. This has nothing to do with `className` being present: it fires
    on *any* interop'd component with a function `style`, `className` or not. A `Pressable` that also
    has a static `className` still shows whatever the className contributed (those are separate,
    additive declarations merged into the same object) — which is what made this bug look like a
    `className`-interaction issue on first pass and led to an incorrect first fix (dropping
    `className`, keeping the function) that made things strictly worse, since it removed the one
    thing that had been rendering.

    **The fix**: never pass a function to a `Pressable`'s `style`. Track `pressed` (or whatever
    interaction state is needed) via local `useState` + `onPressIn`/`onPressOut`, and pass `style` as
    a plain object or array built from that state — e.g. `Button.tsx`, `PeriodBar.tsx`,
    `DatePickerModal.tsx`, `LanguageSection.tsx`, `CollapsibleSection.tsx`, and `AppearanceSection.tsx`
    all follow this shape now. For a row rendered from a `.map()`, track *which* item is pressed (its
    key) in one piece of state rather than one `useState` per row. If a component's public API still
    accepts a caller-supplied function `style` (e.g. `ButtonProps` extends `PressableProps`), evaluate
    it yourself with the locally-tracked state (`style({ pressed, hovered: false })`) and merge the
    result into the plain-object/array `style` you pass down — never forward the function itself into
    the JSX `style` prop.

    ```tsx
    // ❌ Broken — style is a function. Every property in it (background, border,
    // radius, padding) silently vanishes at runtime; only className-derived
    // styles (if any) survive. No error, no warning — it just renders wrong.
    <Pressable
      style={({ pressed }) => ({
        backgroundColor: pressed ? theme.colors.border : theme.colors.surface,
        borderRadius: theme.radius.pill,
        paddingHorizontal: theme.spacing.md,
      })}
    >

    // ✅ Fixed — pressed tracked locally, style is a plain object.
    const [pressed, setPressed] = useState(false);
    <Pressable
      onPressIn={() => setPressed(true)}
      onPressOut={() => setPressed(false)}
      style={{
        backgroundColor: pressed ? theme.colors.border : theme.colors.surface,
        borderRadius: theme.radius.pill,
        paddingHorizontal: theme.spacing.md,
      }}
    >
    ```

    ```tsx
    // ❌ Broken — same bug, one `useState` per row in a .map() (do this instead
    // with a single "which key is pressed" state, not N hooks in a loop):
    {items.map((item) => (
      <Pressable
        key={item.id}
        style={({ pressed }) => ({ backgroundColor: pressed ? theme.colors.surfaceMuted : 'transparent' })}
      >
    ))}

    // ✅ Fixed
    const [pressedId, setPressedId] = useState<string | null>(null);
    {items.map((item) => (
      <Pressable
        key={item.id}
        onPressIn={() => setPressedId(item.id)}
        onPressOut={() => setPressedId(null)}
        style={{ backgroundColor: pressedId === item.id ? theme.colors.surfaceMuted : 'transparent' }}
      >
    ))}
    ```

16. **A swallowed error inside a Postgres transaction still aborts it.** `AuditService.record()`
    never throws, but inside `db.transaction()` a failed insert leaves the transaction in the
    aborted state, so the caller's `COMMIT` silently becomes a rollback — the financial write it
    was auditing disappears with no error. `record()` therefore wraps its insert in a `SAVEPOINT`
    when handed a transaction. Any other best-effort write run inside a caller's transaction needs
    the same shape, or must run outside it.

17. **Device-local data belongs to one identity; never serve it to another.** The guest store is the
    guest's ledger, so a signed-in read must never fall back to it when offline. It showed a "Guest
    Wallet" in place of the user's data, and seeding it routed the user to guest upload. Signed-in
    reads go through `readSignedIn`: on a network failure they rethrow, and RTK Query keeps the last
    data, or the account's own saved copy. The same rule covers every device-local store across a
    user switch. The in-memory cache is reset whenever the session ends. The SQLite read cache
    and the queue rows are keyed by account, so another account's data stays on the device but
    is never read.

18. **A wallet's calendar day is its time zone's, never UTC's or the device's.** `instant.slice(0, 10)`
    and `T00:00:00.000Z` bounds filed every early-morning entry in Vietnam (UTC+7) under the day
    before, in the list, the dashboard and every budget. An instant becomes a wallet day only
    through `packages/contracts/src/calendar.ts` (`dayOfInstant`, `todayIn`, `dayRange`, `withDay`)
    with the wallet's `timeZone`. Every member gets the same day, and a changed zone re-reads
    instants without rewriting them. Display-only times (`formatTimeOfDay`) stay on the device.
