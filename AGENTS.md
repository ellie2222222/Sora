# Sora — Google Antigravity Agent Instructions

> Auto-loaded by Google Antigravity for this workspace. Governs all code, spec, and design decisions in this repo.
>
> To run codebase audits, pre-commit checks, and dead-code/duplication sweeps, invoke the **`double-check`** skill.
> For commit creation, use the **`commit-messages`** skill (drafts only).

The product is a **mobile finance tracker whose headline feature is tracking someone else's money alongside your own** — a partner's, a parent's, a friend's — with a real per-person role on each wallet. Everything below follows from that.

---

## Governing Documents (Precedence Order)

When requirements or documentation disagree, authority is strictly prioritized (highest first):

| # | Document | Authority over |
|---|---|---|
| 1 | [`db/migrations/001_initial_wallet_schema.sql`](file:///d:/Code/sora/db/migrations/001_initial_wallet_schema.sql) | The schema. What the database actually permits |
| 2 | [`packages/contracts/src/`](file:///d:/Code/sora/packages/contracts/src/) | Enums, validation schemas, response types, error codes, route paths, money/derivation math |
| 3 | [`docs/API_SPECIFICATION.md`](file:///d:/Code/sora/docs/API_SPECIFICATION.md) | The 50-endpoint contract: auth, authorization, validation, errors, side effects per endpoint |
| 4 | [`SRS.md`](file:///d:/Code/sora/SRS.md) | What the system does and why — domain model, business flows, user stories |
| 5 | [`SDS.md`](file:///d:/Code/sora/SDS.md) | How it is designed — architecture, sequence flows, feature mapping |

> [!IMPORTANT]
> Where `SRS.md` or `SDS.md` disagree with the migration, the contract, or the API specification, the top three win — update the narrative document rather than coding to it.
> There is deliberately **no** `constitution.md`. Do not reference one.

### Trigger Matrix

| Trigger | Read |
|---|---|
| Adding or renaming a domain entity | [`SRS.md` §2](file:///d:/Code/sora/SRS.md) (CDM), then §4 (business rules) |
| Writing or reviewing a user story | [`SRS.md` §9](file:///d:/Code/sora/SRS.md), the relevant feature only |
| Role or permission change | [`docs/API_SPECIFICATION.md` §2.5](file:///d:/Code/sora/docs/API_SPECIFICATION.md), [`SRS.md` §7](file:///d:/Code/sora/SRS.md) |
| New route, DTO, or validation rule | [`docs/API_SPECIFICATION.md`](file:///d:/Code/sora/docs/API_SPECIFICATION.md), then [`packages/contracts/src/`](file:///d:/Code/sora/packages/contracts/src/) |
| Schema change | Target migration, then [`plans/architecture/domain-database-design.md`](file:///d:/Code/sora/plans/architecture/domain-database-design.md) |
| Architecture or sequence flow | [`SDS.md` §4](file:///d:/Code/sora/SDS.md) |

---

## Core Non-Negotiables & Invariants

1. **Spec-Driven Development**: Confirm behavior is specified before writing code. If a change conflicts with the spec, amend the spec in the same change.
2. **Facts vs. Assumptions**: Assert facts backed by code, commands, or database constraints. Explicitly label inferences as assumptions ("assuming X because Y, worth confirming"). Never guess business rules.
3. **Money is Never a JS Number**: Transferred as strings, stored as `DECIMAL(19,4)`, computed as scaled `bigint` through [`packages/contracts/src/money.ts`](file:///d:/Code/sora/packages/contracts/src/money.ts). `pg-types.ts` forces `NUMERIC` and `INT8` to return text. Never call `Number(amount)`.
4. **Access Control (404 vs. 403)**: Non-members get `404 Not Found`. Never return `403` to someone without a membership row — `403` leaks that the wallet or account ID exists.
5. **Transfers are Neither Income nor Expense**: Transfers are excluded from income, expense, and budget spend calculations. Cross-wallet transfers require `EDITOR` on **both** wallets.
6. **Derived Values are Never Stored**: Balances, spent totals, budget usage, and goal progress are computed dynamically on every read via [`packages/contracts/src/calc.ts`](file:///d:/Code/sora/packages/contracts/src/calc.ts). Never add a cached balance column.
7. **Single Active Owner**: Enforced by partial unique index `uq_wallet_single_owner`. Ownership transfer must demote the current owner before promoting the new owner in a single transaction with `SELECT ... FOR UPDATE`.
8. **Budget Windows Do Not Overlap**: Enforced by Postgres GIST exclusion constraint `excl_budget_overlap`, not a unique index.
9. **Active Locales**: English (`en`) and Vietnamese (`vi`) only. Never translate or touch inactive locales (`de`, `es`, `fr`, `hi`, `ja`, `ko`, `ru`, `zh`).
10. **NativeWind v4 Pressable Style**: Never pass a function to a `Pressable`'s `style` prop (`style={({ pressed }) => ...}` silently fails in NativeWind v4). Track `pressed` with local state + `onPressIn`/`onPressOut`.
11. **Barrel Imports Boundary**: Use `@/...` barrel aliases for imports outside the directory; use direct relative paths for siblings inside the same directory. Orchestrators importing across multiple features use direct paths to prevent require cycles.
12. **Git & Attribution**: Never run `git commit` or `git push` directly. Use the `commit-messages` skill (drafts only). **Zero AI-authorship trailers** (`Co-Authored-By: ...`, `Generated with ...`, model names) in commits, PRs, comments, or documentation.

---

## Project Structure & Architecture

```text
finance/
├── packages/contracts/        # @sora/contracts — Shared source of truth (Zod, enums, money, routes)
│   └── src/                   # enums.ts, money.ts, calc.ts, schemas.ts, responses.ts, routes.ts
├── server/                    # @sora/server — NestJS 11 ESM, Kysely typed SQL, pg
│   └── src/                   # auth/, wallets/, accounts/, categories/, transactions/, budgets/, goals/
├── mobile/                    # @sora/mobile — Expo React Native, Redux Toolkit + RTK Query
│   ├── e2e/                   # Maestro flows + API seed; app.config.js adds the E2E build switch
│   └── src/                   # app/, features/, components/, design-system/, services/
├── db/
│   ├── migrations/            # Raw SQL forward-only migrations (immutable once applied)
│   └── tests/                 # Constraint probes executed against real Postgres
├── scripts/                   # check-contract-parity.mjs, migrate.mjs
├── .agents/
│   ├── rules/                 # Native Antigravity modular rules
│   └── skills.json            # Skill directory registration (.claude/skills)
└── verifications/             # Audits & verification records (YYYY-MM-DD-short-slug.md)
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
| **Budget** | Limit, Allowance | Spend limit for one category over one date range |
| **Saving Goal** | Target, Objective | Target amount, optional deadline, funded by contributions |

---

## Essential Commands

Always prefer using `rtk` to prefix CLI commands to optimize token consumption (e.g. `rtk npm test`):

```bash
npm install                                    # Link all workspaces
npm run build -w @sora/contracts            # Must build before server/mobile typecheck
npm test                                       # Run all unit tests
npm test -w @sora/contracts                 # Test money and calculation math
npm test -w @sora/server                    # Asserts all routes are mounted
npm run typecheck                              # Typecheck all packages
node scripts/check-contract-parity.mjs         # Mechanical schema <-> contracts <-> spec audit
npm run db:migrate                             # Run SQL migrations
npm run db:test                                # Run database constraint probes
npm run dev:server                             # Start server in watch mode
npm run dev:mobile                             # Start Expo mobile app
npm run dev:mobile:clear                       # Same, with Metro's cache cleared
```

---

## Antigravity Rules & Skills

- **Modular Rules**: Detailed rules are organized under [`.agents/rules/`](file:///d:/Code/sora/.agents/rules/):
  - [`antigravity-rtk-rules.md`](file:///d:/Code/sora/.agents/rules/antigravity-rtk-rules.md): CLI token optimization proxy.
  - [`workflow-and-git.md`](file:///d:/Code/sora/.agents/rules/workflow-and-git.md): Spec-driven development, git safety, commit drafting, and verification logs.
  - [`business-rules-and-access.md`](file:///d:/Code/sora/.agents/rules/business-rules-and-access.md): Full definitions of BR-01 to BR-08 and AC-01 to AC-05.
  - [`technical-standards.md`](file:///d:/Code/sora/.agents/rules/technical-standards.md): APIs, money arithmetic, mobile conventions, testIDs, and formatting.
  - [`bug-prevention-and-gotchas.md`](file:///d:/Code/sora/.agents/rules/bug-prevention-and-gotchas.md): The 15 historical bug prevention rules.
- **Skills**: Registered via [`.agents/skills.json`](file:///d:/Code/sora/.agents/skills.json) pointing to `.claude/skills/`:
  - `double-check`: Full codebase verification sweep ending in a report under `verifications/`.
  - `commit-messages`: Analyzes working tree and drafts structured commits (the only sanctioned commit pathway).
  - `comment-audit`, `restructure`, `infra-audit`, `brainstorm-features`, `skill-audit`, and Front-End Checklist skills.
