# Double-check of the year summary, read caching, flag resolver and test-login tooling

**Date:** 2026-10-16T08:34:03Z
**Method:** double-check skill
**Verdict:** PASS
**Scope:** Changes since `2026-10-16-dashboard-year-summary-and-read-caching.md`, plus that pass's own code:
- the year view through `PeriodReport` + `YearlyTrend`;
- the next-period prefetch, `keepUnusedDataFor`, and the background offline save;
- the `metro.config.js` flag resolver;
- `scripts/seed/set-test-passwords.mjs`;
- the `sora_dev` test-account edits (password `1`, `@sora.test` emails).

**Files touched:** `CLAUDE.md`, `AGENTS.md` (Dev Commands: `db:seed:passwords`)
**Related reports:** `2026-10-16-dashboard-year-summary-and-read-caching.md`

## Method

```
npm run typecheck                                   # every workspace + scripts/seed tsconfig
npm run agents:check
node --check scripts/seed/set-test-passwords.mjs
grep -rn "YearlyReport|yearOf|setupListeners|refetchOnFocus" mobile/src docs plans SDS.md SRS.md CLAUDE.md AGENTS.md README.md RUNBOOK.md
grep -rn "example.invalid|SEED_*_EMAIL" scripts/seed     # what depends on the seed email shape
POST /api/v1/auth/login {an@sora.test, "1"}; GET /api/v1/dashboard?walletId=<An's>&dateFrom&dateTo  (API :3000, sora_dev)
```

Phase 1 was a self-review of the files in scope (about 8), not a delegated sweep.

## Findings

1. **Dangling references** to `YearlyReport`, `yearOf`, `setupListeners` and `refetchOnFocus`: none. → PASS
2. **Docs drift.**
   - The Dev Commands lists in `CLAUDE.md` and `AGENTS.md` didn't mention the new `db:seed:passwords`.
   - → fixed in both. RUNBOOK and seed-data-plan already describe it.
3. **Seed email shape.** Only `guest-upload-check.mts` builds a `seed+…@example.invalid` address, for its own throwaway user, and it doesn't read `.env.seed`. `.seed/<runId>.json` is only written, never read back, so its old emails are a stale local record, not an input. → PASS
4. **Background save ordering.** `entry()` captures the owner when the read starts, and each save calls `put` in the order the reads finish. A slower earlier read can't overwrite a newer copy unless the two responses complete out of order, and that case already existed before. → PASS
5. **Prefetch.** It runs only when the anchor isn't in the current period, so it never asks for a future window. The window before was already read for the comparison. → PASS
6. **Metro resolver.**
   - It falls back to `context.resolveRequest` when no custom resolver is set, and `withNativeWind` wraps it afterwards.
   - The export from the last pass showed 0 flag warnings. → PASS
7. **Write safety (CLAUDE.md Data Safety).** `set-test-passwords.mjs` updates only the exact emails listed in `.env.seed` and refuses names outside the seed address patterns. It runs in one transaction, rolls back on a count mismatch, and refuses a database whose name doesn't look disposable. → PASS
8. **Year view against real data.** As An on `sora_dev`:
   - The year 2026, year 2025 and October 2026 windows each returned 200, with income and expense per currency (VND/USD/JPY, never summed; BR-07), 8 active budgets, and 21/18/8 category slices.
   - → PASS
9. **Comments (rule 11).** The new comments are one or two lines and explain why. The script's header documents how to use it, like `seed-demo.mts`. → PASS

## Fixes Applied

- `CLAUDE.md:392` and `AGENTS.md:128`: added `npm run db:seed:passwords` to the Dev Commands block.
- Re-verified: `npm run typecheck` exit 0 (contracts, server, mobile, seed); `npm run agents:check` reports 11 skills in sync.
- Mobile tests were not re-run: nothing under `mobile/src` changed since they last passed (749 pass, 0 fail).

## Follow-ups

- Still open: an on-device check of the year card, the chart skeleton, and stepping between periods (no emulator).
- `.seed/01688f14.json` still lists the pre-rename seed emails. It's gitignored and nothing reads it.
