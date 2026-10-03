# Test plan: Accounts

**Stories:** SRS §9 ACC-US-01 Create · ACC-US-02 List across wallets · ACC-US-03 Detail · ACC-US-04 Correct · ACC-US-05 Archive
**Contract:** API spec §9 Accounts, §16.3 Deletion policy
**Rules:** BR-05 (balance derived on read, never stored), BR-07 (one currency per account), VL-04 (`initialBalance` is the one signed amount), rule 1 (money never a JS number; `DECIMAL(19,4)` kept exactly), AC-01
**Code under test:** `server/src/accounts/`, `packages/contracts/src/calc.ts` (`calculateAccountBalance`), `mobile/src/features/accounts/`, `mobile/src/services/guest/guestAccounts.ts`, `mobile/src/services/sync/pendingTotals.ts`

## Objectives

1. Every balance equals opening amount + completed money in − completed money out, to the last of 4 decimals.
2. Transfers are reported apart from income and expense on the account detail.
3. Currency, type and opening amount can't change after creation; archiving keeps history and blocks new entries.

## Test data & environment

- `createAccount(api, user, walletId, { currency, initialBalance })` ([probe-data.ts:45](../../server/test/support/probe-data.ts#L45)); each test creates its own account, so balances aren't shared between tests.
- `calc.test.ts` uses the same fixture ledger the SQL probe suite seeds ([calc.test.ts:26](../../packages/contracts/test/calc.test.ts#L26)).

## Test cases

| ID | Story | Scenario | Type | Expected result | Automated by | Status |
|---|---|---|---|---|---|---|
| TC-ACC-01 | ACC-US-01 | Credit card opening negative; opening defaults to 0 | Unit + DB probe | Accepted; default `0` | [integration.accounts:42](../../server/test/integration.accounts.test.ts#L42), [schemas:255](../../packages/contracts/test/schemas.test.ts#L255), [schemas:266](../../packages/contracts/test/schemas.test.ts#L266), [001_constraints:155](../../db/tests/001_constraints.sql#L155), [calc:129](../../packages/contracts/test/calc.test.ts#L129) | Covered |
| TC-ACC-02 | ACC-US-01 | Account type outside the four allowed | Unit + DB probe | Rejected by schema and by `chk_account_type` | [schemas:277](../../packages/contracts/test/schemas.test.ts#L277), [001_constraints:150](../../db/tests/001_constraints.sql#L150) | Covered |
| TC-ACC-03 | ACC-US-01 | VIEWER creates an account | Integration | 403 `FORBIDDEN` | [integration.access:96](../../server/test/integration.access.test.ts#L96) | Covered |
| TC-ACC-04 | ACC-US-01 | Create in an archived wallet; create is audited | Integration | 409 `WALLET_ARCHIVED`; `ACCOUNT_CREATED` audit row | [integration.accounts:61](../../server/test/integration.accounts.test.ts#L61) | Covered |
| TC-ACC-05 | ACC-US-02 | List with no wallet, with one wallet, filtered by status/type, naming a wallet with no membership | Integration | Every reachable wallet's accounts / only that wallet's / filtered / 404 `WALLET_NOT_FOUND`; each with a derived balance | [integration.accounts:82](../../server/test/integration.accounts.test.ts#L82) | Covered |
| TC-ACC-06 | ACC-US-03 | Completed, pending and deleted expenses on one account | Integration + Unit | Balance moves by completed rows only (`899.5000`); calc ignores PENDING/DELETED | [integration.ledger:58](../../server/test/integration.ledger.test.ts#L58), [calc:71](../../packages/contracts/test/calc.test.ts#L71), [calc:106](../../packages/contracts/test/calc.test.ts#L106) | Covered |
| TC-ACC-07 | ACC-US-03 | Opening balance `999999999999999.9999` | Integration + Unit | Read back exactly | [integration.ledger:71](../../server/test/integration.ledger.test.ts#L71), [money:50](../../packages/contracts/test/money.test.ts#L50) | Covered |
| TC-ACC-08 | ACC-US-03 | A transfer between two accounts | Integration + Unit | One pass debits one side and credits the other; both balances move | [integration.ledger:76](../../server/test/integration.ledger.test.ts#L76), [calc:86](../../packages/contracts/test/calc.test.ts#L86) | Covered |
| TC-ACC-09 | ACC-US-03 | Detail totals | Integration | `totalIncome`, `totalExpense`, `transferredIn`, `transferredOut` reported separately; `transactionCount` includes deleted rows | [integration.accounts:127](../../server/test/integration.accounts.test.ts#L127), [integration.ledger:58](../../server/test/integration.ledger.test.ts#L58); guest copy [guestDerived:132](../../mobile/src/services/guest/guestDerived.test.ts#L132), [:141](../../mobile/src/services/guest/guestDerived.test.ts#L141) | Covered |
| TC-ACC-10 | ACC-US-03 | A non-member reads a real account id and a made-up one | Integration | Both 404 `ACCOUNT_NOT_FOUND`, indistinguishable | [integration.access:59](../../server/test/integration.access.test.ts#L59), [integration.access:79](../../server/test/integration.access.test.ts#L79) | Covered |
| TC-ACC-11 | ACC-US-04 | `PATCH` name; `PATCH` type or opening balance; `PATCH` currency on an empty account, one with a transaction, one with an earmark | Integration | 200 with the new name and an `ACCOUNT_UPDATED` audit row; type and `initial_balance` unchanged (read back by SQL); currency changes only on the empty account, otherwise 422 `ACCOUNT_CURRENCY_MISMATCH` and unchanged (§9.4) | [integration.accounts:155](../../server/test/integration.accounts.test.ts#L155), [integration.accounts:173](../../server/test/integration.accounts.test.ts#L173), guest copy [guestAccounts:17](../../mobile/src/services/guest/guestAccounts.test.ts#L17) | Covered |
| TC-ACC-16 | ACC-US-04 | A currency change and a transaction create on the same empty account at the same moment, in either order | Integration (two DB transactions) | The second waits on the account row lock; once the first commits it gets 422 `ACCOUNT_CURRENCY_MISMATCH` and writes nothing (§9.4) | [integration.accounts:212](../../server/test/integration.accounts.test.ts#L212), [integration.accounts:229](../../server/test/integration.accounts.test.ts#L229) | Covered |
| TC-ACC-12 | ACC-US-05 | Archive, then record a transaction against it | Integration | 204; then 409 `ACCOUNT_ARCHIVED` | [integration.accounts:248](../../server/test/integration.accounts.test.ts#L248), [integration.planning:118](../../server/test/integration.planning.test.ts#L118) | Covered |
| TC-ACC-13 | ACC-US-05 | An archived account's history | Integration | Still in the list (marked) and readable; past transfers, including cross-wallet ones, still resolve both sides; audited | [integration.accounts:270](../../server/test/integration.accounts.test.ts#L270) | Covered |
| TC-ACC-14 | ACC-US-05 | Guest archives the last active account; archives one twice | Mobile unit | Refused; second archive is a no-op | [guestDerived:153](../../mobile/src/services/guest/guestDerived.test.ts#L153), [:160](../../mobile/src/services/guest/guestDerived.test.ts#L160) | Covered (guest only) |
| TC-ACC-15 | ACC-US-01 | Account created offline | Mobile unit | Its signed opening balance shows in its wallet's total and dashboard, in its own currency only | [pendingTotals:192](../../mobile/src/services/sync/pendingTotals.test.ts#L192), [:199](../../mobile/src/services/sync/pendingTotals.test.ts#L199) | Covered |
| TC-ACC-17 | ACC-US-05 | Archive the wallet's other active account while one archive is in flight | Integration (two DB transactions) | Waits on the wallet's active accounts, then 409 `ACCOUNT_LAST_ACTIVE`; one account stays active | [integration.concurrency:114](../../server/test/integration.concurrency.test.ts#L114) | Covered |
| TC-ACC-18 | ACC-US-05 | Record a transaction on an account being archived | Integration (two DB transactions) | Waits on the account row, then 409 `ACCOUNT_ARCHIVED`; nothing written | [integration.concurrency:133](../../server/test/integration.concurrency.test.ts#L133) | Covered |

## Gaps, by risk

None open. Writing TC-ACC-11 showed the spec said currency was never editable while the contract allows it on an empty account; §9.4 and SRS ACC-US-04 now describe the contract, and "empty" now also excludes an earmark contribution.
