# Infrastructure audit: mobile redesign in flight, webpage/ drift, server/db/CI re-verification

**Date:** 2026-09-12T16:37:25Z
**Method:** infra-audit skill (Phase 2 delegated to three parallel scan agents — mobile redesign,
root/webpage clutter, server+db+CI re-verification against the prior report — findings taken as
reported, spot-checked against the agents' cited evidence rather than re-run from scratch)
**Verdict:** PASS (read-only pass; one architectural finding needs a human decision, not a fix)
**Scope:** Broad, weighted toward what actually changed since the last audit. `mobile/` (75 tracked
files modified + ~35 untracked new files — an in-progress 5-tab redesign plus what turns out to be a
substantially-executed Redux/RTK Query migration), root-level untracked docs, `webpage/` (uncommitted
theming work in a directory CLAUDE.md documents as "parked"), and a re-verification of every Tier-1
follow-up from the prior audit against `server/`, `packages/contracts/`, `db/migrations/`, which had
only two small tracked diffs since.
**Files touched:** none — read-only pass.
**Related reports:** [2026-09-03-infra-audit.md](2026-09-03-infra-audit.md),
[2026-09-11-mobile-ui-redesign.md](2026-09-11-mobile-ui-redesign.md),
[2026-09-11-tab-navigator-redesign-and-mulish-font.md](2026-09-11-tab-navigator-redesign-and-mulish-font.md)

## Method

Three scans in parallel, each read-only and told to cite `file:line` evidence rather than assume:
(1) the mobile/ redesign diff and its ~35 new untracked files, (2) root-level untracked docs plus the
`webpage/` package, (3) re-verification of the prior report's 7 open Tier-1 items against current
`server/`/`db/`/CI state, plus running the same command suite the prior audit ran. Findings below are
the union, deduplicated and re-tiered.

## Findings

### 1. Tier 2/architectural — an RTK Query migration is already substantially executed, not just planned, and contradicts CLAUDE.md MB-02

`REDUX_RTK_QUERY_MIGRATION_PLAN.md` (root, untracked) reads as a proposal, but the code is already
there: `mobile/src/App.tsx:13,24,59,74` wraps the app in `ReduxProvider`, and 29 screens/components
already call RTK Query hooks from `mobile/src/app/store/api/*`
(e.g. `AccountsScreen.tsx:11` `useListAccountsQuery`, `AddTransactionScreen.tsx:21`
`useCreateTransactionMutation`). Only `AuthProvider.tsx` and `QueryProvider.tsx` still touch
`@tanstack/react-query`. CLAUDE.md MB-02 states "Server state is TanStack Query; UI state is
Zustand" — this migration is a live divergence from that rule, not a hypothetical one, and per
CLAUDE.md's own "code does not lead, specs do," it needs an explicit decision (finish the migration
and update MB-02, or revert) rather than being left half-landed. No test coverage exists for the new
data layer either — the plan doc says so itself (`REDUX_RTK_QUERY_MIGRATION_PLAN.md:232-235`),
confirmed by only 6 `.test.ts(x)` files total under `mobile/src`.

**This is a decision for you, not something the audit should resolve unilaterally** — flagging per
CLAUDE.md's "ask at a real architectural fork" guidance.

### 2. Tier 1 — NativeWind/Tailwind is fully wired into mobile/ but has zero adoption

`babel.config.js`, `metro.config.js`, `tailwind.config.js`, `global.css`, `nativewind-env.d.ts`, and
the relevant `package.json` deps are all present and building, but `grep -rl "className=" mobile/src
--include=*.tsx` returns zero hits across all 77 `.tsx` files. Every screen still styles through the
existing design-token/`StyleSheet` system. This is dead configuration today; worth confirming intent
before it's built on further. Compounding this: `mobile/tailwind.config.js:9-22` hardcodes its own
color hex values independent of `mobile/src/design-system/colors.ts` — a second color source of
truth that will drift the moment adoption resumes.

### 3. Tier 1 — dead duplicate theming files in `webpage/`

`webpage/src/components/theme-switcher.tsx` (new, untracked) is a full second `ThemeSwitcher`
implementation; the live one both layouts actually import is `@/components/ui/theme-switcher`
(the modified existing file) — zero importers of the new one. Same story for
`webpage/src/components/theme-provider.tsx` (new): `webpage/src/components/providers/
dark-mode-provider.tsx` is the one actually wired, and the new file has zero importers. Three files
now implement two concepts. Delete the two orphans once confirmed unused (verified: zero importers
via grep).

### 4. Tier 1 — active, uncommitted work in a directory CLAUDE.md calls "parked"

CLAUDE.md's Dev Commands section explicitly excludes `webpage/` from the documented workflow ("not
`mobile/`... and not the parked `webpage/`"), and root `package.json`'s workspaces list
(`packages/*`, `server`, `mobile`) confirms `webpage` isn't a linked workspace — it's outside
`npm test`/`npm run typecheck`/CI entirely. Yet `git diff --stat -- webpage/` shows real,
uncommitted theming work landing there right now with zero verification gate. Worth a decision:
un-park it (add to workspaces, wire into CI) or confirm this is throwaway local experimentation that
shouldn't be committed as-is.

### 5. Tier 1 — stray files with no home in the documented layout

- `HANDOFF.md` (root, untracked) — a completed-feature (guest mode) handoff note referencing a
  machine-local plan path. Session scratch, not living documentation; belongs in `verifications/` as
  a completion record or should be removed once the feature's landed state is confirmed.
- `ui-design-rules-of-thumb.md` (root, untracked) — generic, project-agnostic UI/UX notes with no
  Sora-specific content and no reference from CLAUDE.md's doc table. Reads like a personal reference
  file that landed in the repo by accident.
- `mobile/src/check_hardcoded.js` (untracked) — an ad hoc Node debug script (regexes `.tsx` files for
  hardcoded strings) sitting inside `src/`, unimported, no CLI wiring. Belongs in `scripts/` at the
  repo root if kept, otherwise deleted.
- `mobile/src/hooks/useNetworkStatus.ts` is a 40-byte re-export shim (`export * from
  './useNetworkStatus.tsx'`) sitting next to the real implementation — confusing, pick one filename.
- 8 now-empty `hooks/` directories under `mobile/src/features/*` left behind by the RTK migration
  removing the old TanStack Query hook files without removing their directories.

### 6. Checked and clean — EmptyState/ErrorState → StateView migration

No dangling references to the deleted `EmptyState.tsx`/`ErrorState.tsx` remain anywhere in
`mobile/src`; the new `StateView.tsx` is the sole replacement and is used across 15+ screens. No
action needed.

### 7. Checked and clean — 10-locale i18n expansion

All 8 new locale files (`de`, `es`, `fr`, `hi`, `ja`, `ko`, `ru`, `zh`) are registered in
`i18n/index.ts:17-71` alongside the modified `en`/`vi`, with dev-only key-mismatch warnings and
spot-checked real (non-stub) translations in `de.ts`/`zh.ts`. Only gap: the key-parity check is a
`__DEV__`-only console warning, not enforced in CI.

### 8. Re-verified against the 2026-09-03 audit's Tier-1 follow-ups

The only tracked changes in `server/`, `packages/contracts/`, `db/` since that report are
`goals.controller.ts`/`wallets.controller.ts` (swap literal pagination bounds for new
`DEFAULT_PAGE_SIZE`/`MAX_PAGE_SIZE` constants) and `enums.ts`/`schemas.ts`/`money.ts` (10-locale
`LOCALES`, the same pagination constants, and new `stripCurrencyInput`/`formatCurrencyInput`
comma-formatting helpers — pure string manipulation, doesn't touch rule 1's bigint/float concerns).
Status of the prior 7 items:

| Item | Status |
|---|---|
| `verify-boot.ts` still present | **Still open** |
| Pool timeouts (`idleTimeoutMillis` etc.) | **Still open** — `database.service.ts:18-21` unchanged |
| Non-sargable date filter (`transactions.service.ts:254,257`) | **Still open**, unchanged |
| Missing indexes (wallet_members, accounts, audit_logs, trigram) | **Still open** — no new migration |
| `main.ts` CORS/helmet/body-limit | **Partially fixed already** — `enableCors()` landed same-day as the prior report (`56f7408`, before that report's own commit); no origin allowlist, no helmet, no body-size limit still open |
| Lint no-op | **Still open**, unchanged |
| Server test suite empty | **Fixed** — `server/test/routes.test.ts` (`df46cb0`, same day) asserts every `ROUTES` path is mounted; `npm test -w @sora/server` → 3/3 pass. This also closes the prior report's own "add a route-table assertion" ask |

Command re-run this pass: `typecheck -w @sora/server` clean, `typecheck -w @sora/mobile` clean,
`check-contract-parity.mjs` 31/31, `npm test -w @sora/contracts` 63/63 (up from 61), `npm test -w
@sora/server` 3/3 (up from 0). Live Postgres exercise still BLOCKED, same as the prior report — no
usable role/`DATABASE_URL` in this environment.

Everything else from the prior report's Tier 2/3 follow-ups (unbounded transaction scans, audit
rows written outside their transaction, BR-07 unprobed, dead `derive.ts`, no error boundary, unbounded
in-memory rate-limit state) was not re-scanned this pass — none of the six changed files touch them
and the rest of `server/`/`db/` is untouched since 09-03, so that report's findings still stand as
the current record for those areas.

## Fixes Applied

None — read-only pass per the infra-audit skill's own framing ("findings are suggestions, not
mandates"). Finding 1 in particular is a decision for you, not something to silently resolve.

## Follow-ups

Carried forward or new, tiered by impact/effort:

**Tier 1 — quick wins**
- Delete the two orphaned `webpage/` theming files (Finding 3) once you've confirmed nothing external
  references them.
- Decide NativeWind's fate (Finding 2): finish adoption or strip the dead config before it drifts
  further from `design-system/colors.ts`.
- Clear the stray files (Finding 5): move or delete `HANDOFF.md`, `ui-design-rules-of-thumb.md`,
  `mobile/src/check_hardcoded.js`; collapse `useNetworkStatus.ts`/`.tsx` to one file; remove the 8
  empty leftover `hooks/` directories.
- All 7 still-open items from the prior audit's Tier 1 (verify-boot.ts, pool timeouts, non-sargable
  filter, missing indexes, CORS allowlist/helmet/body-limit, lint no-op) remain open — see the table
  above, unchanged from 2026-09-03.

**Tier 2 — strategic, needs a decision**
- **Finding 1 (RTK Query migration)** — the highest-priority item in this report. It's already ~90%
  landed in code while contradicting a written architecture rule (MB-02) and carrying zero test
  coverage. Needs an explicit call: finish + update CLAUDE.md, or revert before it goes further.
- **Finding 4 (`webpage/` parked-but-active)** — decide whether to un-park it into CI/workspaces or
  stop landing uncommitted work there.
- Enforce the i18n key-parity check (Finding 7) in CI instead of `__DEV__`-only.

**Tier 3 — unchanged from the prior report**
- Everything under the 2026-09-03 report's own Tier 2/3 (unbounded transaction scans, audit-outside-
  transaction, BR-07 unprobed, dead `derive.ts`, no mobile error boundary/crash reporting, unbounded
  in-memory rate-limit/idempotency state) — not re-scanned this pass, still the current record.
