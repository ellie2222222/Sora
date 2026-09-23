# Double-check + comment audit: remainder of this session's uncommitted diff

**Date:** 2026-09-23T00:00:00Z
**Method:** double-check skill, invoked via `/double-check /comment-audit`
**Verdict:** PASS — 1 require-cycle bug fixed, 5 stale/self-contradictory comments fixed, 1 overlong doc-comment condensed
**Scope:** The full uncommitted `git status` diff, minus what
[2026-09-23-comment-audit-toast-and-period-summary.md](2026-09-23-comment-audit-toast-and-period-summary.md)
already covered (toast system, `PeriodSummaryCard`, the 9 create-action call sites, `en.ts`/`vi.ts`).
This pass covers everything else still uncommitted: the settings-screen redesign components, the
inactive-locale key removal, `docker-compose.yml`/`CLAUDE.md`/`README.md`/`RUNBOOK.md`/`.env.example`
port documentation, and the server auth/env multi-audience Google OAuth change.
**Files touched:**
[docker-compose.yml:2-8](../docker-compose.yml#L2-L8),
[CLAUDE.md:341](../CLAUDE.md#L341),
[README.md:227-229](../README.md#L227-L229),
[RUNBOOK.md:62-64](../RUNBOOK.md#L62-L64),
[server/src/config/env.ts:39-42](../server/src/config/env.ts#L39-L42),
[mobile/src/app/providers/ToastProvider.tsx:7-9](../mobile/src/app/providers/ToastProvider.tsx#L7-L9)
**Related reports:**
[2026-09-23-comment-audit-toast-and-period-summary.md](2026-09-23-comment-audit-toast-and-period-summary.md)
(sibling pass, same session, disjoint scope — see above)

## Method

Read `CLAUDE.md` fresh (Part 7 rule 11 for comments, rule 14 for the barrel/require-cycle rule).
Ran `git status`/`git diff` to enumerate every uncommitted file, cross-referenced against the
existing same-day comment-audit report to exclude what it already covered, then reviewed each
remaining file's diff directly (all small enough not to need a delegated exploration agent).

## Findings

### Fixed

1. **Self-contradictory "defaults to 5432, not 5432" port comment, 4 locations** (rule 11 pattern 4,
   stale) — `docker-compose.yml:5`, `CLAUDE.md:341`, `README.md:227`, `RUNBOOK.md:62`. Root cause:
   an earlier edit this session changed `docker-compose.yml`'s actual `POSTGRES_HOST_PORT` fallback
   from `5433` to `5432` (a real, intentional, already-tested config change — confirmed via this
   session's own `docker compose up -d postgres` + clean log check), but the surrounding prose's
   `5433`→`5432` find-replace only caught the first number in each sentence, leaving a comparison
   against itself ("X, not X") and a stale "override to use 5432 directly" framing that assumed the
   opposite default. Rewrote all four to state the current, verified-correct default (5432, same as
   the documented host Postgres) and reframe the override instruction accordingly (override *if* a
   host Postgres is already running, not *to* reach 5432).
2. **`ToastProvider.tsx:7`** (rule 14, require-cycle) — imported `Text` via the `@/components`
   barrel. Every component in `components/` imports `useTheme` back through the `app/providers`
   barrel (confirmed via grep — 29 files), so this closed the exact cycle shape rule 14 documents
   for `ModalProvider.tsx`, newly, since no other file in `app/providers/` imports from
   `@/components`. Changed to a direct relative import (`../../components/Text`) with a 2-line
   comment citing rule 14, breaking the cycle without needing to exclude `ToastProvider` from its
   own barrel (unlike `ModalProvider`, it isn't an orchestrator — one component, not a broad reach).
3. **`server/src/config/env.ts:39-47`** (rule 11, overlong doc-comment) — the `GOOGLE_CLIENT_ID`
   JSDoc was 8 lines; condensed to 3, matching this file's own `decoyHash` precedent (4 lines) for a
   comment carrying real non-obvious rationale. No content lost: multi-audience-per-platform reason
   still stated, just tighter.

### Checked, no issue found

- Settings redesign components (`CollapsibleSection`, `AppearanceSection`, `LanguageSection`,
  `ProfileHeader`, `SyncSection`, `AboutSection`) — diffs are pure JSX/style changes (icon size/color,
  removed `Sparkles` decorative icons, removed the "Active" badge), no comments added, removed, or
  made stale.
- Inactive locale files (`de`/`es`/`fr`/`hi`/`ja`/`ko`/`ru`/`zh.ts`) — one key removed each
  (`settings.activeAccount`), no comments in translation object literals to audit. Confirmed zero
  remaining references to the removed key anywhere in `mobile/src` (grep, clean).
  `mobile/src/app/i18n/locales/en.ts`/`vi.ts` already covered by the sibling report.
- `mobile/src/app/config/env.ts`, `server/Dockerfile`, `webpage/Dockerfile`, `webpage/README.md` —
  bare port-number corrections (3001→3000), no comments touched, no stale comment left behind
  (checked the surrounding docstring in `env.ts` specifically — doesn't mention a literal port number).
- `.env.example`'s `GOOGLE_CLIENT_ID` comment (7 lines) — left as-is: `.env.example` already has an
  established convention of longer explanatory blocks (e.g. the `PORT` section above it), distinct
  from source-code comment conventions rule 11 targets.
- `server/src/auth/auth.service.ts:75` — the `OAuth2Client()` comment is the already-corrected
  1-line version from earlier in this session; still 1 line, no drift.
- Repo-wide grep for `3001`/`5433` (the old stale port numbers) — zero remaining hits anywhere
  outside `node_modules`, confirming the port cleanup is now fully consistent.

### Flagged, not fixed

None this pass.

## Fixes Applied

1. Rewrote the 4-location port comment (docker-compose.yml, CLAUDE.md, README.md, RUNBOOK.md) —
   comment/prose-only in the first three; `docker-compose.yml`'s edit was also comment-only (the
   functional `ports:`/`healthcheck:`/`PORT:` lines it sits above were already correct from an
   earlier edit this session, untouched by this fix). Re-verified: `git diff -- docker-compose.yml`
   shows only the header comment block changed in this pass.
2. `ToastProvider.tsx`'s import fix is a one-line code change (not comment-only, since it's a
   real cycle-breaking fix, not just an audit note) plus a 2-line comment. Re-verified:
   `npx tsc --noEmit` (mobile) clean, `npm test -w @sora/mobile` 218/218 passing.
3. `env.ts` JSDoc condensation — comment-only. Re-verified: `npx tsc --noEmit` (server, after
   `npm run build -w @sora/contracts`) clean, `npm test -w @sora/server` 11/11 passing.

## Follow-ups

Carried forward from [2026-09-23-comment-audit-toast-and-period-summary.md](2026-09-23-comment-audit-toast-and-period-summary.md),
still open, not touched by this pass:

- `mobile/src/features/dashboard/screens/HomeScreen.tsx:12-14` — debug-journal-style clause.
- `AccountPicker.tsx`/`CategoryPicker.tsx`/`CategoryGrid.tsx` — duplicated default-to-first-item
  comment/logic across three files.
- `StateView.tsx:66-70` — long fallback-justification comment.

None new from this pass.
