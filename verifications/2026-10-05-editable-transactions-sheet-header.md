# Editable transactions (BR-03 reversed), one Add/Edit form, one sheet header, button roles

**Date:** 2026-10-05T05:42:31Z
**Method:** ad hoc
**Verdict:** PASS (code paths, suites, bundle); device UI not exercised
**Scope:** the user's request: the modal Cancel moves top-right; Edit Transaction uses the Add form with amount, type and account editable; Back on nested sheets; the Edit Budget/Goal buttons. BR-03 reversed at the user's direction ("just edit them normally").
**Files touched:** contract `schemas.ts`/`responses.ts` (+tests); server `transactions.service.ts`/`.controller.ts`, `app-error.ts`, `integration.ledger.test.ts`; mobile `TransactionFormModal.tsx` (new, replaces `AddTransactionModal.tsx`/`EditTransactionModal.tsx`), `SheetHeader.tsx` (new, replaces `SheetFormHeader.tsx`), `BottomSheetModal.tsx`, `ModalContext.ts`/`ModalProvider.tsx`, guest/offline/optimistic transaction paths, every sheet's header props, Budget/Goal/Account edit cards, Category dialog, WalletSwitcher, i18n; docs CLAUDE.md BR-03 + NC-04, `.agents/rules`, API spec §11.4, SRS BR-08/TXN-US-07, SDS, DESIGN_GUIDELINES, test plans, plans
**Related reports:** [2026-09-03-edit-transaction-txn-us-07.md](2026-09-03-edit-transaction-txn-us-07.md) (superseded: it built the descriptive-fields-only edit)

## Method

```bash
npm test -w @sora/contracts                              # schemas, merge helper
node scripts/check-contract-parity.mjs
docker run -d --name scratch-int-09504641 -e POSTGRES_DB=sora_test -p 127.0.0.1:5545:5432 postgres:17
DATABASE_URL=postgresql://postgres:scratch@127.0.0.1:5545/sora_test node scripts/migrate.mjs
DATABASE_URL=…5545/sora_test npm run test -w @sora/server   # unit + integration
npm run typecheck
npm run test -w @sora/mobile
(cd mobile && npx expo export --platform android --output-dir <scratch>)
grep -rn "TRANSACTION_IMMUTABLE|SheetFormHeader|EditTransactionModal|AddTransactionModal" (code + docs)
```

## Findings

- **BR-03 conflict:** the request (edit amount/type/account) contradicted BR-03. Asked; the user chose in-place editing. Implemented as: an update carrying `type`/`amount`/`currency`/an account is merged over the stored row by `mergeTransactionUpdate` (contracts, shared by server, guest and offline paths) and checked by `createTransactionSchema` plus the server's create checks (`checkWrite`: roles on every wallet, archived, currency, category, goal tag). Audited against wallets touched before and after. A goal contribution backed by the payment follows its amount/account; making that payment non-expense is 422.
- `TRANSACTION_IMMUTABLE` removed from `ERROR_CODES`, server/guest messages, mobile error map, i18n.
- Integration, real Postgres: amount 100→250 moves balance 1000→750; moving the account restores the old one and debits the new; expense→income flips both; 3 audit rows. A type change without the account, wrong category type, other-currency account, same-account transfer, zero amount → create's error each time, row unchanged in SQL. A contribution-backed payment: amount+account mirror into `goal_contributions`; type → income 422, row unchanged. Server 225/225 (was 222).
- Guest ledger mirrors it (29/29). Offline money edit: the cache reverses the old figures and applies the new as one in-place change (`LedgerChange.inPlace`: no count bump, recent row replaced not added); `pendingTotals` 30/30.
- **One form:** `TransactionFormModal` is both Add and Edit (`transactionId` set = edit: filled via `draftFromTransaction`, saved via `updateBodyOf` which sends only changed fields). Same type buttons, pickers, category grid, keypad, date picker, validation. Edit adds the loading skeleton, error and deleted states the old edit sheet had. Changing account now also takes that account's currency (Add had hardcoded `VND`; a USD account would have been refused).
- **Header:** `BottomSheetModal` renders `SheetHeader` for any titled sheet: Back left only when there is somewhere to go back to, title centred, Cancel (forms) / Close right, muted. A sheet inside another gets Back automatically (context) and Close closes the stack; `ModalParams.parent` gives Back to Edit Transaction from the detail sheet (reopens it) and Add Contribution from the goal sheet; the Category dialog's rename step and WalletSwitcher's sub-pages pass `onBack`. Duplicate footer Cancel/Close buttons removed (date picker, action sheet, category dialog).
- **Buttons:** Edit Budget / Edit Goal (and Edit Account) used solid `danger` for Archive/Cancel goal, full width under Save, which outweighed the primary action; everywhere else solid `danger` is only a confirmation's destroy button and a secondary destructive action is `danger-outline` (transaction detail) or `danger-soft` (settings). Changed to `danger-outline`. Goal detail's hand-built "Add contribution" pressable (primary icon, default text) → shared `Button` `secondary` `sm`. Save keeps the design system's disabled tokens until a change. Rule added to DESIGN_GUIDELINES "Button roles".
- Contracts 131/131; parity 58/58; typecheck clean; mobile 624/624; Android bundle 3777 modules, 7.5 MB hbc; no stale references to removed names in code.

## Fixes Applied

As above. A test I wrote mid-pass asserted a number amount is refused; the schema deliberately accepts numbers (`schemas.ts:52-53`), so the assertion was corrected to the real behaviour, not removed.

## Follow-ups

- **Not checked on a device:** Add vs Edit side by side, the Back/Close stack, button pressed/disabled states. No emulator was running; needs a manual pass or the E2E run in CI.
- Edit no longer shows a Reference field (the Add form has none); the stored reference is kept untouched. Add it to the shared form if it should stay editable.
- An offline money edit doesn't move a backed goal's progress in the cache; the sync pass corrects it.
