# Four E2E test-plan cases marked covered after a green CI run

**Date:** 2026-10-04T11:43:07Z
**Method:** ad hoc
**Verdict:** PASS
**Scope:** TC-TXN-35, TC-SYNC-20, TC-GST-09 and TC-GST-18. Each was waiting on a green E2E run, and CI run 37193860635 (commit `5f8ce9c`) passed every job.
**Files touched:** `docs/test-plans/README.md`, `transactions.md`, `offline-sync.md`, `guest.md`
**Related reports:** [2026-10-04-wallet-rename-account-currency.md](2026-10-04-wallet-rename-account-currency.md), [2026-10-03-swipe-row-actions.md](2026-10-03-swipe-row-actions.md)

## Method

- `gh run view 37193860635 --json status,conclusion,jobs`
- `gh run view 37193860635 --log --job 111411936781`: the E2E job, scanned for each flow's result line and the summary.
- Read each flow and compared its assertions with the plan row's expected result.
- Recounted every `| TC-` row's status across the plans and compared the totals with the README table.
- Resolved each new `#L` link to the flow line it names.

## Findings

- **Run 37193860635:** `completed success`. All five jobs passed: contracts, database, server, mobile, and Mobile E2E. The E2E log shows `8/8 Flows Passed in 8m 11s`. The `Failed to find ColorBuffer` lines are emulator GPU noise and match no flow failure.
- **TC-TXN-35 → `swipe-delete-transaction.yaml`**, Passed (47s).
  - Before the swipe, no Delete button is mounted (`:31`).
  - After it, Delete and Edit show (`:37`, `:41`).
  - Once the delete is confirmed, the row leaves the list (`:48`).
  - Matches the row. Covered.
- **TC-SYNC-20 → `offline-sync.yaml`**, Passed (1m 10s).
  - Offline, the "Changes waiting to sync" indicator shows (`:29`), then "Data synced" once back online (`:37`).
  - The API then holds exactly one row (`:47`, `matches == 1`).
  - Matches. Covered.
- **TC-GST-09 → `guest-relaunch.yaml`**, Passed (47s).
  - With no `clearState`, a relaunch lands on home, not login (`:15`, `:19`), and the guest's expense is still shown (`:21`).
  - Covered; the store-level link is kept alongside.
- **TC-GST-18 → `guest-upload-register.yaml` + `guest-upload-choose-wallet.yaml`**, both Passed (1m 20s, 1m 27s).
  - When there is only one candidate wallet, the upload starts without the choice screen (register `:36`) and lands exactly one row (`:57`).
  - Leaving without choosing brings the same choice back (choose-wallet `:30`–`:33`).
  - The upload lands one row in the chosen wallet (`:55`).
  - A relaunch no longer offers the choice, so the local data was discarded after the upload (`:57`–`:64`).
  - All three clauses of the row are asserted. Covered.
- **Totals recount:** 257 cases: 255 covered, 2 partial (TC-GST-08, TC-AI-12), 0 gap. These match the updated README row.
- **Stale README note removed.** It said E2E was failing on `main` before this work, which this run disproves.

## Fixes Applied

- `transactions.md`, `offline-sync.md`, `guest.md`: the four rows are now Covered, with line links to the asserting steps. Their Gaps entries are removed, leaving only TC-GST-08 in guest.
- `README.md`: totals updated (Transactions 35/35, Guest 17/1/0, Offline sync 20/20, Total 255/2/0); the "Where to start" list reduced to the remaining partial item; the stale E2E-failing note removed; counts dated to this report.

## Follow-ups

- **TC-GST-08 and TC-AI-12 remain Partial.** Both are render or slice code that bare-node tests can't load. An E2E flow (a guest session with the network blocked, or the guest AI tab) would close them.
- **Not covered by any flow:** wallet rename, wallet swipe-archive, and changing an empty account's currency.
