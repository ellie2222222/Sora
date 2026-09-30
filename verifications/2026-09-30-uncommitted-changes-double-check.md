# Double-check of all uncommitted changes (wallet sheet, accounts in dashboard, AI tab)

**Date:** 2026-09-30T02:58:27Z
**Method:** double-check skill
**Verdict:** PASS (server and database exercised; mobile verified by typecheck and unit tests, not on a device)
**Scope:** every change in `git status`: 60 modified files and the new AI, wallet-sheet and dashboard files, including the edits made to `ai.service.ts`, `transactions.service.ts`, `aiApi.ts` and `AiChatScreen.tsx` after the previous report
**Files touched:** `.gitignore`, `mobile/src/app/store/api/pendingTotalsPatch.ts`, `mobile/src/features/chat/screens/AiChatScreen.tsx`, `mobile/src/features/chat/components/ChatInputBar.tsx`, `mobile/src/features/dashboard/screens/DashboardScreen.tsx`, `mobile/src/features/wallets/components/WalletMembersPanel.tsx`, `mobile/src/app/i18n/locales/{en,vi}.ts` (`ai.sendFailed` removed), `server/src/ai/ai.service.ts` (trailing whitespace)
**Related reports:** 2026-09-29-ai-tab-and-account-dashboard.md, 2026-09-29-wallet-sheet-and-offline-wallets.md

## Method

- `git status --short`, `git diff`; read `ai.service.ts`, `transactions.service.ts` (diff), `aiApi.ts`, `AiChatScreen.tsx`
- Read-only sweep agent over the scoped files (dead code, duplication, CLAUDE.md Part 5/7 rules, i18n, correctness); each finding re-checked by grep/read
- `npm run build -w @sora/contracts`; `node scripts/check-contract-parity.mjs`; `npm run typecheck -w @sora/server`; `npm run typecheck -w @sora/mobile`; `npm run agents:check`
- Scratch DB: `docker run -d --name scratch-dc-2fd8 … postgres:17` on 127.0.0.1:55432; `node scripts/migrate.mjs --constraints`; `npm run test -w @sora/server`; psql audit query below; `docker rm -f -v scratch-dc-2fd8`
- `npm run test -w @sora/mobile`

## Findings

- New since the last report: `TransactionsService.create(…, trx?)`, and `confirmAction` passes its transaction. The insert, the audit row and the CONFIRMED update now commit together. This closes the previous follow-up about a PENDING draft with a recorded transaction → PASS (evidence below).
- `AiChatScreen.tsx`: after the switch to the infinite query, a `useMemo` ran after `if (activeWalletId === null) return` (Rules of Hooks; crashes when the wallet goes from null to set) → fixed.
- `mobile/.export/` (7.5 MB output of the existing `npm run export`) was untracked and not ignored → fixed.
- HIGH `pendingTotalsPatch.ts`: queued offline writes and new-account balances were patched into every cached `getDashboardSummary`, including the new account-scoped entries. Those patches reason at wallet level (a sibling transfer counts as internal, a new account adds to the total) → fixed; scoped entries are skipped and wait for the sync refetch.
- MED `AiChatScreen.tsx`: a new chat was selected before its first send finished, so the messages fetch could return the empty list and hide the first exchange → fixed.
- MED `WalletMembersPanel.tsx`: remove-member and revoke-invitation were fire-and-forget. This already happened at HEAD in `WalletMembersScreen` → fixed.
- LOW `ChatInputBar.tsx`: a failed send lost the typed text → fixed. `ai.sendFailed` could never render because `getServerErrorMessage` never returns an empty string → key removed.
- LOW `DashboardScreen.tsx`: the render after a wallet switch queried (new wallet, old account), a wasted 404; the yearly chart kept months from the old scope → fixed.
- No references remain to the removed screens, routes or `onManage` (grep of mobile/src, mobile/e2e, server, packages).
- No Pressable with a function `style`, no deep cross-directory imports, no colour literals, no `Number(amount)` in the scoped files.
- Contracts build clean; parity 38/38; server and mobile typecheck clean; agent skills in sync (10) → PASS.
- Scratch DB: `PASS 001_constraints.sql`, `PASS 002_ai_messages.sql`; server tests 85 pass, 0 fail, 0 skipped → PASS.
- Audit on the confirmed proposal:
  `select m.action_status, t.amount, (select count(*) from audit_logs a where a.entity_id = m.action_transaction_id::text and a.event like 'TRANSACTION%CREATE%') …` returned `CONFIRMED|65000.0000|1`. `DISMISSED|1` is untouched → PASS.
- Teardown: containers and 17 dangling volumes match the pre-run baseline.
- Mobile tests: 528 pass, 0 fail (re-run after the fixes) → PASS.

## Fixes Applied

- `.gitignore`: `.export/` added next to `.expo/`. Re-checked: `git check-ignore mobile/.export` reports it ignored.
- `AiChatScreen.tsx`: `items` memo moved above the early return. `send` selects the conversation after the send resolves and returns a success flag.
- `ChatInputBar.tsx`: puts the text back when `onSend` resolves false.
- `pendingTotalsPatch.ts`: `patchEach` takes an `include` filter. The dashboard patches pass `isWalletWideDashboard`, which excludes args with `accountId`.
- `WalletMembersPanel.tsx`: `runAction` unwraps the result and shows the error through the existing `actionError`.
- `DashboardScreen.tsx`: the scope is stored with its wallet id and derived for the active wallet, replacing the reset effect. `YearlyReport` is keyed by scope.
- `en.ts`/`vi.ts`: `ai.sendFailed` removed.
- All re-verified: mobile typecheck 0 errors; mobile tests 528 pass; parity 38/38.

## Follow-ups

- `wallets.manageWallets` and `wallets.guestWallet` are no longer read, since the "Manage wallets…" row and the "Guest Wallet" display were removed. They can't be deleted from en.ts without touching the 8 inactive locales that still carry them (TS2353), and CLAUDE.md rule 13 keeps those files untouched. Needs a decision.
- Moved, not new, code in the wallet panels still has the NC-04 and i18n gaps it had as screens:
  - `wallet-detail-*` testIDs; StateViews without testIDs;
  - icon-only Pressables without accessibility labels (WalletDetailPanel);
  - English-only `SUGGESTED_LABELS` (InviteMemberPanel);
  - raw audit event, entity and result text (WalletActivityPanel);
  - `CreateWalletForm` borrows `categories.name` for its label.
- Duplication:
  - server `displayAmount` in `mock-llm.provider.ts` is a third digit-grouping copy, and it ignores per-currency decimals;
  - `AccountRow` exists in both `WalletDetailPanel` and `AccountsOverview`;
  - `WalletMembersPanel` formats a date with `.slice(0, 10)`.
- The chat's proposal card decides whether to show Confirm from the active wallet's role, not the role in the wallet the draft was made in. The server still enforces the real role on confirm.
- `sendMessage` calls the provider before its insert transaction. A conversation deleted in that window gives a 500 from the foreign key instead of a 404.
- Carried forward: `CategoryList` has no navigation entry point (already so at HEAD); stale `WalletListScreen`/`WalletMembersScreen` mentions in `mobile/MODAL_UI_STATE.md` and `mobile/GAPS.md`.
