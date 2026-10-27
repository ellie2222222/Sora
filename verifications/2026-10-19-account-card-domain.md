# Accounts vs payment cards: domain audit and credit-card liability handling

**Date:** 2026-10-19T08:37:28Z
**Method:** ad hoc
**Verdict:** PASS
**Scope:** Account types, net worth, credit-card ledger behaviour, Add Account flow and card face, after the request to separate financial accounts from payment cards
**Files touched:** `packages/contracts/test/calc.test.ts`, `mobile/src/features/accounts/accountBalance.ts` (+ test), `AddAccountModal.tsx`, `AccountCard.tsx`, `CardDetailsFields.tsx`, 10 locale files, `SRS.md`
**Related reports:** 2026-10-19-account-card-deck.md

## Method

- Read `ACCOUNT_TYPES`/`accountTypeHasCard` (`packages/contracts/src/enums.ts:36`), `calculateAccountBalance` (`calc.ts:50`), `netWorthByCurrency` (`mobile/src/features/accounts/netWorth.ts:12`), `AddAccountModal.tsx` balance handling, migration 006
- `npm run test -w @sora/contracts`, `npm run test -w @sora/mobile`, `npx tsc --noEmit -p mobile`, `node scripts/check-contract-parity.mjs`

## Findings

1. Types → `BANK_ACCOUNT | CASH | E_WALLET | CREDIT_CARD`; no `DEBIT_CARD`, no payment-instrument entity, no credit-limit column. Card data is display-only (network, last 4) on bank/credit accounts (`chk_account_card_details_type`). No full number, CVV or PIN anywhere. PASS
2. Net worth → per currency (BR-07), assets = non-negative balances, liabilities = negative balances, net = assets + liabilities (each balance counted once). Matches the screen: 27,215,000 − 4,634,000 = 22,581,000. PASS
3. Ledger → a credit card opens negative; an expense from it deepens the debt; a bank→card TRANSFER moves both balances and is excluded from income/expense (`countsAsPeriodActivity`); income onto the card reverses a purchase. New tests in `calc.test.ts` "credit card as a liability account" (4). PASS
4. **Overlap / defect:** the credit-card opening field read "Opening balance (negative if you owe)". Entering the owed amount without a minus booked the debt as an asset, overstating net worth by twice the debt. FAIL → fixed
5. **Overlap:** nothing told users that a debit card belongs on its bank account, which invited a second account holding the same money. FAIL → fixed (hint)
6. Card face → a credit card in debt showed "-₫4,634,000", which reads like a negative asset rather than an amount owed. Fixed: "Owed" label + unsigned amount.
7. Archive → accounts are archived, never deleted; transactions stay; no instrument references exist to break. PASS

## Fixes Applied

- `accountBalance.ts` `openingBalanceFor` negates the owed amount for CREDIT_CARD; `AddAccountModal.tsx:93` uses it; label → "Amount owed now" (10 locales).
- `accountBalance.ts` `cardBalanceOf` → `AccountCard.tsx` shows "Owed" + unsigned amount.
- `CardDetailsFields.tsx` shows `accounts.debitCardHint` on bank accounts.
- Re-verified: contracts 184/184, mobile 797/797, typecheck clean, parity 141/141.

## Follow-ups

- Account detail and transaction rows still show a credit card's balance signed; only the deck card says "Owed".
- Credit limit not modelled (no requirement); if added, it must stay out of net worth.
- Not checked on a device this pass.
