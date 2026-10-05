# Sora — Agent Instructions (Codex, Google Antigravity)

> Auto-loaded by OpenAI Codex and Google Antigravity for this workspace. Governs all code, spec, and design decisions in this repo.
>
> This file and [`.agents/rules/`](.agents/rules/) are a port of [`CLAUDE.md`](CLAUDE.md), which is the complete, canonical rulebook. **Where they disagree, `CLAUDE.md` wins** — fix the port rather than coding to it. Skills and verification reports point into `CLAUDE.md` by section; read that section when they do.
>
> To run codebase audits, pre-commit checks, and dead-code/duplication sweeps, invoke the **`double-check`** skill.
> For commit creation, use the **`commit-messages`** skill (drafts only).

The product is a **mobile finance tracker whose headline feature is tracking someone else's money alongside your own** — a partner's, a parent's, a friend's — with a real per-person role on each wallet. Everything below follows from that.

---

## Governing Documents (Precedence Order)

When requirements or documentation disagree, authority is strictly prioritized (highest first):

| # | Document | Authority over |
|---|---|---|
| 1 | [`db/migrations/001_initial_wallet_schema.sql`](db/migrations/001_initial_wallet_schema.sql) | The schema. What the database actually permits |
| 2 | [`packages/contracts/src/`](packages/contracts/src/) | Enums, validation schemas, response types, error codes, route paths, money/derivation math |
| 3 | [`docs/API_SPECIFICATION.md`](docs/API_SPECIFICATION.md) | The endpoint contract: auth, authorization, validation, errors, side effects per endpoint |
| 4 | [`SRS.md`](SRS.md) | What the system does and why — domain model, business flows, user stories |
| 5 | [`SDS.md`](SDS.md) | How it is designed — architecture, sequence flows, feature mapping |

> [!IMPORTANT]
> Where `SRS.md` or `SDS.md` disagree with the migration, the contract, or the API specification, the top three win — update the narrative document rather than coding to it.
> There is deliberately **no** `constitution.md`. Do not reference one.

### Trigger Matrix

| Trigger | Read |
|---|---|
| Adding or renaming a domain entity | [`SRS.md` §2](SRS.md) (CDM), then §4 (business rules) |
| Writing or reviewing a user story | [`SRS.md` §9](SRS.md), the relevant feature only |
| Role or permission change | [`docs/API_SPECIFICATION.md` §2.5](docs/API_SPECIFICATION.md), [`SRS.md` §7](SRS.md) |
| New route, DTO, or validation rule | [`docs/API_SPECIFICATION.md`](docs/API_SPECIFICATION.md), then [`packages/contracts/src/`](packages/contracts/src/) |
| Schema change | Target migration, then [`plans/architecture/domain-database-design.md`](plans/architecture/domain-database-design.md) |
| Architecture or sequence flow | [`SDS.md` §4](SDS.md) |

---

## Core Non-Negotiables & Invariants

1. **Spec-Driven Development**: Confirm behavior is specified before writing code. If a change conflicts with the spec, amend the spec in the same change.
2. **Facts vs. Assumptions**: Assert facts backed by code, commands, or database constraints. Explicitly label inferences as assumptions ("assuming X because Y, worth confirming"). Never guess business rules.
3. **Money is Never a JS Number**: Transferred as strings, stored as `DECIMAL(19,4)`, computed as scaled `bigint` through [`packages/contracts/src/money.ts`](packages/contracts/src/money.ts). `pg-types.ts` forces `NUMERIC` and `INT8` to return text. Never call `Number(amount)`.
4. **Access Control (404 vs. 403)**: Non-members get `404 Not Found`. Never return `403` to someone without a membership row — `403` leaks that the wallet or account ID exists.
5. **Transfers are Neither Income nor Expense**: Transfers are excluded from income, expense, and budget spend calculations. Cross-wallet transfers require `EDITOR` on **both** wallets.
6. **Derived Values are Never Stored**: Balances, spent totals, budget usage, and goal progress are computed dynamically on every read via [`packages/contracts/src/calc.ts`](packages/contracts/src/calc.ts). Never add a cached balance column.
7. **Single Active Owner**: Enforced by partial unique index `uq_wallet_single_owner`. Ownership transfer must demote the current owner before promoting the new owner in a single transaction with `SELECT ... FOR UPDATE`.
8. **Budget Windows Do Not Overlap**: Enforced by Postgres GIST exclusion constraints (`excl_budget_category_overlap`, plus `excl_budget_goal_overlap` and `excl_budget_overall_overlap` for goal and wallet-wide budgets), not a unique index.
9. **Active Locales**: English (`en`) and Vietnamese (`vi`) only. Never translate or touch inactive locales (`de`, `es`, `fr`, `hi`, `ja`, `ko`, `ru`, `zh`).
10. **NativeWind v4 Pressable Style**: Never pass a function to a `Pressable`'s `style` prop (`style={({ pressed }) => ...}` silently fails in NativeWind v4). Track `pressed` with local state + `onPressIn`/`onPressOut`.
11. **Barrel Imports Boundary**: Use `@/...` barrel aliases for imports outside the directory; use direct relative paths for siblings inside the same directory. Orchestrators importing across multiple features use direct paths to prevent require cycles.
12. **Git & Attribution**: Never run `git commit` or `git push` directly. Use the `commit-messages` skill (drafts only). **Zero AI-authorship trailers** (`Co-Authored-By: ...`, `Generated with ...`, model names) in commits, PRs, comments, or documentation.
13. **Destructive Commands & Data Safety**: Never delete, reset, drop, or discard anything (files, git work, databases, Docker volumes) without explicit permission for that specific action, and verify which instance a command targets first — a host Postgres and the optional Docker Postgres can both be reachable.

---

## Project Structure & Architecture

```text
sora/
├── packages/contracts/        # @sora/contracts — Shared source of truth (Zod, enums, money, routes)
│   └── src/                   # enums.ts, money.ts, calc.ts, schemas.ts, responses.ts, routes.ts, starter-categories.ts
├── server/                    # @sora/server — NestJS 12 ESM, Kysely typed SQL, pg; Dockerfile (optional image)
│   └── src/                   # auth/, wallets/, accounts/, categories/, transactions/, budgets/, goals/, dashboard/,
│                              # audit/, ai/, exchange-rate/, health/, config/, database/, common/
├── mobile/                    # @sora/mobile — Expo React Native, Redux Toolkit + RTK Query
│   ├── e2e/                   # Maestro flows + API seed; app.config.js turns GWP-ASan off and adds the E2E build switch
│   └── src/                   # app/, features/, components/, design-system/, services/ (incl. haptics/), hooks/, utils/
├── db/
│   ├── migrations/            # Raw SQL forward-only migrations (immutable once applied)
│   └── tests/                 # Constraint probes executed against real Postgres
├── scripts/                   # migrate.mjs (migration runner), check-contract-parity.mjs, sync-agent-skills.mjs, audit-runtime-deps.mjs
├── docs/                      # API_SPECIFICATION.md, DESIGN_GUIDELINES.md, ERROR_CODES.md, LOCALIZED_DEFAULTS_RULE.md
│   └── test-plans/            # Per-feature test plans: SRS §9 story → test case → test file:line
├── plans/                     # architecture/ and mobile/ design plans
├── webpage/                   # Parked; not part of the build, CI or compose
├── .github/                   # workflows/ci.yml, dependabot.yml
├── .agents/
│   ├── rules/                 # Topic rule files (read on trigger — see below)
│   ├── skills/                # Codex skills: generated copy of .claude/skills — do not edit here
│   └── skills.json            # Antigravity skill registration (.claude/skills)
├── .codex/                    # Codex project layer: config.toml (MCP), hooks.json, rules/
├── .claude/skills/            # Canonical skill sources (Claude Code, Antigravity, Codex copy)
├── verifications/             # Audits & verification records (YYYY-MM-DD-short-slug.md)
├── docker-compose.yml         # Optional server/ + Postgres stack
└── CLAUDE.md  SRS.md  SDS.md  RUNBOOK.md  README.md  aif-sdlc-checklist.md
```

> [!NOTE]
> There is **no** `backend/` and **no** `frontend/`. Those belonged to a deleted legacy stack and must never be referenced.

---

## Terminology

| Term | Not | Note |
|---|---|---|
| **Wallet** | Household, Family, Group | One person's finances: "Tam's Wallet", "Mom's Wallet". Sharing boundary; no tier above it |
| **Member** | Participant, Collaborator | Row in `wallet_members`: holds `OWNER`, `EDITOR`, or `VIEWER` plus `relationLabel` |
| **Account** | Sub-wallet | Where money sits: Vietcombank, Cash, MoMo. Belongs to exactly one wallet |
| **Transaction** | Entry, Record | `INCOME`, `EXPENSE`, `TRANSFER`. Belongs to an account, never directly to a wallet |
| **Budget** | Limit, Allowance | Spend limit for one category, one goal, or the whole wallet over one date range |
| **Saving Goal** | Target, Objective | Target amount, optional deadline, funded by contributions |

---

## Essential Commands

Always prefer using `rtk` to prefix CLI commands to optimize token consumption (e.g. `rtk npm run test`):

```bash
npm install                                    # Link all workspaces
npm run build -w @sora/contracts            # Emits dist/ only; server/mobile resolve src/ via exports
npm test                                       # Run all unit tests
npm test -w @sora/contracts                 # Test money and calculation math
npm test -w @sora/server                    # Asserts all routes are mounted
npm run typecheck                              # Typecheck all packages
node scripts/check-contract-parity.mjs         # Mechanical schema <-> contracts <-> spec audit
npm run agents:check                           # .agents/skills matches .claude/skills
npm run db:migrate                             # Run SQL migrations
npm run db:test                                # Run database constraint probes
npm run dev:server                             # Start server in watch mode
npm run dev:mobile                             # Start Expo mobile app
npm run dev:mobile:clear                       # Same, with Metro's cache cleared
```

---

## Rules (read on trigger)

Codex does not auto-load [`.agents/rules/`](.agents/rules/); read the matching file before acting:

| Before… | Read |
|---|---|
| Running shell commands | [`antigravity-rtk-rules.md`](.agents/rules/antigravity-rtk-rules.md) — `rtk` proxy usage |
| Any git operation, destructive command, verification pass, or final response that touched files | [`workflow-and-git.md`](.agents/rules/workflow-and-git.md) — git protocol, summary format, `verifications/` reports |
| Touching wallets, members, transactions, budgets, goals, invitations, or authorization | [`business-rules-and-access.md`](.agents/rules/business-rules-and-access.md) — BR-01…BR-08, AC-01…AC-05 |
| Writing API, mobile, money, migration, or test code | [`technical-standards.md`](.agents/rules/technical-standards.md); mobile UI also [`docs/DESIGN_GUIDELINES.md`](docs/DESIGN_GUIDELINES.md) (tokens only, Part 4 check) |
| Any non-trivial change | [`bug-prevention-and-gotchas.md`](.agents/rules/bug-prevention-and-gotchas.md) — the rules learned from past bugs |

---

## Skills

Project skills: `double-check`, `commit-messages`, `comment-audit`, `restructure`, `extract-modules`, `i18n-audit`, `scratch-probe`, `infra-audit`, `brainstorm-features`, `skill-audit`.

- **Codex** discovers them in [`.agents/skills/`](.agents/skills/); invoke explicitly with `$double-check`, `$commit-messages`, etc., or let a matching request trigger one.
- **Antigravity** reads them straight from `.claude/skills/` via [`.agents/skills.json`](.agents/skills.json), including the vendored Front-End Checklist corpus (left out of the Codex copy to keep its skill catalog small).
- `.agents/skills/` is a generated copy. Edit `.claude/skills/<name>/`, then run `npm run agents:sync`; CI fails on drift.
- The skills were written for Claude Code. Read "the Skill tool" as invoking the named skill, "an Agent/subagent" as a sub-agent if one is available (otherwise do the step yourself), and "TodoWrite" as your plan/checklist.

---

## Codex Setup

Everything under [`.codex/`](.codex/) loads **only after this project is trusted** (Codex asks on first open, or set `trust_level = "trusted"` for this path under `[projects]` in `~/.codex/config.toml`). New or changed hooks also need a one-time review via `/hooks`.

- **CodeGraph** — [`.codex/config.toml`](.codex/config.toml) registers the `codegraph` MCP server over this repo's local `.codegraph/` index. Reach for `codegraph_explore` before grep or reading files to locate or understand code; `codegraph explore "<symbols or question>"` in the shell gives the same output. Requires `codegraph` on `PATH`.
- **Hooks** — [`.codex/hooks.json`](.codex/hooks.json) runs `codegraph prompt-hook` on each prompt, injecting CodeGraph context for structural questions (a no-op otherwise).
- **Command rules** — [`.codex/rules/sora.rules`](.codex/rules/sora.rules) makes Codex prompt before `git commit`/`push`/`reset`/`clean`/`restore`, file deletion, `migrate.mjs --reset`, `db:reset`, and Docker volume removal. A prompt is a backstop, not permission: the rules in this file still decide whether to ask for the command at all.
