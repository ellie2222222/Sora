# Double-check: session's accumulated changes (api/frontend rename, SDS reconciliation, checklist fixes, Sora rebrand)

**Date:** 2026-08-25T10:29:21Z
**Method:** double-check skill
**Verdict:** PASS
**Scope:** All uncommitted changes in the repo at the time of this pass (108 tracked files + 1
untracked) — accumulated across one session: `api/`→`server/` and `frontend/`→`webpage/`
directory rename, `SDS.md` full reconciliation against the wallet-model codebase, the
`aif-sdlc-checklist.md` stale-reference fixes, the `@finance/*`→`@sora/*` / "Finance Tracker"→
"Sora" rebrand, a new CLAUDE.md "Destructive Commands" rule, `.env.example`'s new Google
client-id vars, and the `/home/app/finance`→`/home/app/sora` folder rename. Scope taken as "the
whole session's unreviewed work" since nothing had been committed yet and the user asked to
double-check before `/commit-messages`.
**Files touched:** `packages/contracts/test/money.test.ts` (fix); folder moved
`/home/app/finance` → `/home/app/sora` (host filesystem, not a git-tracked change);
`mobile/eas.json` unstaged (was pre-staged from outside this session, `git reset HEAD --`)
**Related reports:** none (first report in this repo — `verifications/` did not exist before this
pass)

## Method

- `grep -rl "@finance/\|finance-tracker\|finance-api\|financetracker\|com\.finance"` across the
  whole tree (excluding `node_modules`, `.git`, `webpage/`, `package-lock.json`)
- `npm run typecheck` (root, all workspaces: `@sora/contracts`, `@sora/server`, `@sora/mobile`)
- `npm run test --workspace @sora/contracts` (money/derivation math, `node --test`)
- `node scripts/check-contract-parity.mjs`
- `docker compose config --quiet` (exit-code check only, no secret values printed)
- `cat mobile/eas.json` (read the new untracked file that appeared mid-session from an EAS setup
  step)
- `git status --short .env` / `git ls-files .env` (confirm never tracked)
- Existence check on every file a doc cross-link points at (`server/Dockerfile`,
  `webpage/PARKED.md`, `RUNBOOK.md`, `docs/API_SPECIFICATION.md`, `SRS.md`, `SDS.md`)
- `[ -d backend ]` (confirm no leftover empty directory from the very first rename decision this
  session)
- Post-folder-rename: re-ran `node scripts/check-contract-parity.mjs` and `git status` from
  `/home/app/sora` to confirm nothing broke; `grep -rl "/home/app/finance\|app/finance"` across
  the tree to rule out a hardcoded absolute path anywhere

## Findings

1. **No leftover `@finance/`/`finance-tracker`/`finance-api`/`financetracker`/`com.finance`
   anywhere in source** — the only match was `.codegraph/codegraph.db`, a binary index that
   reindexes automatically. PASS.
2. **All three workspaces typecheck clean** (`@sora/contracts`, `@sora/server`, `@sora/mobile`) —
   no errors from the rename or the rebrand's ~90-file import-scope change. PASS.
3. **`@sora/contracts` unit tests: 1 of 61 failing before this pass.**
   `test/money.test.ts:30` asserted `formatMoney(add(parseMoney('0.1'), parseMoney('0.2')))`
   equals `'0.3001'`. The arithmetically correct value (and what the code actually returns) is
   `'0.3000'` — `0.1 + 0.2 = 0.3` exactly once scaled to an integer, which is the entire point of
   the test (per its own comment: "0.1 + 0.2 !== 0.3 in floating point; the whole reason money is
   scaled"). Confirmed via `git diff --stat -- packages/contracts/src/money.ts
   packages/contracts/test/money.test.ts` returning empty that neither file was touched this
   session — **this is a pre-existing bug**, not a regression from the rebrand/rename. FAIL,
   fixed below.
4. **Contract parity: 31/31 passing**, unaffected by the rename/rebrand. PASS.
5. **`docker compose config` resolves cleanly** with the new `sora-*` container/volume/DB-default
   names. PASS.
6. **`mobile/eas.json`** (new, from an EAS setup step earlier in the session) is a plain
   `eas.json` — build profiles (`development`/`preview`/`production`) and `cli`/`submit` blocks,
   no secrets or environment-specific values baked in. PASS. It was staged (`A`) from outside this
   pass's own actions; unstaged per CLAUDE.md's Git section ("Do not stage `git add` in
   anticipation of a commit... a pre-staged index hides changes from [`commit-messages`'s] `git
   diff` read") so the upcoming `/commit-messages` run sees it uniformly with everything else.
7. **`.env` has never been tracked by git** (`git ls-files .env` empty) — the real secret/config
   values (including the Google client id and generated `JWT_SECRET` set earlier this session)
   were never at risk of being committed. PASS.
8. **Every doc cross-link target exists** (`server/Dockerfile`, `webpage/PARKED.md`,
   `RUNBOOK.md`, `docs/API_SPECIFICATION.md`, `SRS.md`, `SDS.md`) — no dangling references left
   by the `api/`→`server/`, `frontend/`→`webpage/` rename. PASS.
9. **No leftover empty `backend/` directory** (removed at the very start of this session, before
   the `api/`→`server/` rename). PASS.
10. **Folder rename (`/home/app/finance` → `/home/app/sora`) introduced nothing broken**: no file
    anywhere hardcodes the old absolute path (`grep` clean); `check-contract-parity.mjs` and
    `git status` both re-ran clean from the new path. No containers were running at rename time
    (`docker ps` empty for both `finance`/`sora` filters), so there was no orphaned-compose-project
    risk. PASS. Note for the user: this was a plain filesystem `mv`, not a git operation — nothing
    about it is captured in the commit `/commit-messages` is about to draft, and any IDE window
    still pointed at the old path will need to be reopened at `/home/app/sora`.

## Fixes Applied

- [packages/contracts/test/money.test.ts:30](../packages/contracts/test/money.test.ts#L30) —
  changed the expected string from `'0.3001'` to `'0.3000'`. Re-verified: `npm run test --workspace
  @sora/contracts` now reports `61 pass, 0 fail`.

## Follow-ups

- None new. Carrying forward the two already flagged during the session (not re-litigated here,
  see the chat record): `POST /invitations/preview`/`POST /invitations/accept` are specified but
  unimplemented (`SDS.md` §5.2/§8), and `docs/API_SPECIFICATION.md` §3's endpoint index itself is
  slightly stale (missing `/auth/google`, `/auth/me/preferences`; still lists the two unimplemented
  invitation routes).
