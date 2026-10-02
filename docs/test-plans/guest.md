# Test plan: Guest mode

**Stories:** SRS §9 GST-US-01 Try the app without an account · GST-US-02 Bring my guest data into a real wallet
**Contract:** SRS Flow §8.10; API spec §2.10 Idempotency (what upload resume relies on)
**Rules:** rule 17 (device-local data belongs to one identity; a signed-in read never falls back to the guest store); the guest ledger mirrors server rules BR-03/04/06/07 so a guest learns the real product
**Code under test:** `mobile/src/services/guest/` (`guestStore`, `guestSeed`, `guestAccounts`, `guestTransactions`, `guestBudgets`, `guestGoals`, `guestCategories`, `guestDashboard`, `guestWallets`, `guestUpload`), `mobile/src/app/store/api/signedInRead.ts`, `mobile/src/features/guest/`

## Objectives

1. A guest can use every feature with no network, and the data survives a relaunch.
2. The guest ledger computes the same figures as `@sora/contracts` would.
3. Upload is exactly-once per entry, survives an app kill at any point, and discards local data only after everything has landed.
4. Guest data never appears to a signed-in user.

## Test data & environment

- In-memory persistence and fixtures from [guest/testSupport.ts](../../mobile/src/services/guest/testSupport.ts).
- `guestUpload.test.ts` drives `uploadGuestData` against a recording fake API that can fail or lose a response after "committing", to simulate a kill mid-upload ([guestUpload.test.ts:311](../../mobile/src/services/guest/guestUpload.test.ts#L311)).
- No server is involved, so every case here is a mobile unit test.

## Test cases

| ID | Story | Scenario | Type | Expected result | Automated by | Status |
|---|---|---|---|---|---|---|
| TC-GST-01 | GST-US-01 | Store hydrate: empty, persisted, twice, corrupt blob, older shape (including rows saved before goal tags) | Mobile unit | Empty / read back / no-op / empty rather than throw / missing fields filled | [guestStore:12](../../mobile/src/services/guest/guestStore.test.ts#L12)–[:54](../../mobile/src/services/guest/guestStore.test.ts#L54), [guestStore:64](../../mobile/src/services/guest/guestStore.test.ts#L64) | Covered |
| TC-GST-02 | GST-US-01 | Mutate, clear, subscribe, switch persistence | Mobile unit | Persisted on every mutation; clear empties memory and storage together; listeners fire and stop | [guestStore:74](../../mobile/src/services/guest/guestStore.test.ts#L74)–[:132](../../mobile/src/services/guest/guestStore.test.ts#L132) | Covered |
| TC-GST-03 | GST-US-01 | Overlapping hydrate, mutate-before-hydrate, clear-during-hydrate | Mobile unit | One storage read; no change lost; stays empty after clear | [guestStore:170](../../mobile/src/services/guest/guestStore.test.ts#L170), [:185](../../mobile/src/services/guest/guestStore.test.ts#L185), [:198](../../mobile/src/services/guest/guestStore.test.ts#L198) | Covered |
| TC-GST-04 | GST-US-01 | First launch as a guest | Mobile unit | Wallet seeded with every starter category at the current version; versioned backfill | [guestSeed:31](../../mobile/src/services/guest/guestSeed.test.ts#L31)–[:69](../../mobile/src/services/guest/guestSeed.test.ts#L69) | Covered |
| TC-GST-05 | GST-US-01 | Transactions: create, shape and currency rules, archived account, immutable fields, delete by status, list sort/filter/page | Mobile unit | Same outcomes as the server rules (see [transactions.md](transactions.md)) | [guestTransactions:43](../../mobile/src/services/guest/guestTransactions.test.ts#L43)–[:351](../../mobile/src/services/guest/guestTransactions.test.ts#L351) | Covered |
| TC-GST-06 | GST-US-01 | Derived figures | Mobile unit | Balance, budget spend and goal progress agree with an independent `calc.ts` call | [guestDerived:62](../../mobile/src/services/guest/guestDerived.test.ts#L62), [:181](../../mobile/src/services/guest/guestDerived.test.ts#L181), [:329](../../mobile/src/services/guest/guestDerived.test.ts#L329), [guestTransactions:363](../../mobile/src/services/guest/guestTransactions.test.ts#L363)–[:384](../../mobile/src/services/guest/guestTransactions.test.ts#L384) | Covered |
| TC-GST-07 | GST-US-01 | Categories, budgets, goals, wallet and dashboard rules | Mobile unit | As in [categories.md](categories.md), [budgets.md](budgets.md), [goals.md](goals.md), [dashboard.md](dashboard.md) | [guestCategories.test.ts](../../mobile/src/services/guest/guestCategories.test.ts), [guestDerived:169](../../mobile/src/services/guest/guestDerived.test.ts#L169)–[:526](../../mobile/src/services/guest/guestDerived.test.ts#L526), [guestDashboard.test.ts](../../mobile/src/services/guest/guestDashboard.test.ts) | Covered |
| TC-GST-08 | GST-US-01 | Guest session makes no network request | Mobile unit | No `fetch`/axios call while a guest uses any feature | [guestNoNetwork:50](../../mobile/src/services/guest/guestNoNetwork.test.ts#L50), [:128](../../mobile/src/services/guest/guestNoNetwork.test.ts#L128) | Partial — every guest service API driven with fetch/XHR/http(s) stubbed; the `selectIsGuest` branch in `app/store/api/*Api.ts` is not (those modules import `@/` barrels node can't load) |
| TC-GST-09 | GST-US-01 | Relaunch the app as a guest on a device | E2E | The guest's data is still there | store-level only: [guestStore:21](../../mobile/src/services/guest/guestStore.test.ts#L21) | Gap — no device test |
| TC-GST-10 | rule 17 | Signed-in read while offline | Mobile unit | Rethrows (RTK Query keeps the last data) or answers from that account's saved copy; never reads the guest store | [signedInRead:16](../../mobile/src/app/store/api/signedInRead.test.ts#L16), [:22](../../mobile/src/app/store/api/signedInRead.test.ts#L22), [:49](../../mobile/src/app/store/api/signedInRead.test.ts#L49), [:54](../../mobile/src/app/store/api/signedInRead.test.ts#L54) | Covered |
| TC-GST-11 | GST-US-02 | Upload ordering | Mobile unit | Categories → accounts → transactions → budgets → goals → contributions; nothing when there is no local wallet | [guestUpload:312](../../mobile/src/services/guest/guestUpload.test.ts#L312), [:328](../../mobile/src/services/guest/guestUpload.test.ts#L328) | Covered |
| TC-GST-12 | GST-US-02 | Id remapping | Mobile unit | Only server ids sent; every mapping recorded for resume; client date and status preserved | [guestUpload:338](../../mobile/src/services/guest/guestUpload.test.ts#L338), [:359](../../mobile/src/services/guest/guestUpload.test.ts#L359), [:375](../../mobile/src/services/guest/guestUpload.test.ts#L375) | Covered |
| TC-GST-13 | GST-US-02 | Category already exists in the target wallet | Mobile unit | Reused case-insensitively; another type gets a type-suffixed name, reused on resume; children land under the mapped parent | [guestUpload:388](../../mobile/src/services/guest/guestUpload.test.ts#L388)–[:431](../../mobile/src/services/guest/guestUpload.test.ts#L431) | Covered |
| TC-GST-14 | GST-US-02 | Kill mid-upload, including after the server committed but before the response arrived | Mobile unit | Nothing re-created; the same idempotency key resent for every create; progress reset if the target wallet changes | [guestUpload:463](../../mobile/src/services/guest/guestUpload.test.ts#L463)–[:542](../../mobile/src/services/guest/guestUpload.test.ts#L542) | Covered |
| TC-GST-15 | GST-US-02 | Contribution that recorded money leaving | Mobile unit | Uploaded once through `addContribution`; the server's transaction id mapped back | [guestUpload:598](../../mobile/src/services/guest/guestUpload.test.ts#L598), [:621](../../mobile/src/services/guest/guestUpload.test.ts#L621) | Covered |
| TC-GST-16 | GST-US-02 | Goal statuses and archived entities | Mobile unit | Cancel/complete only after contributions land; archives last, budgets before categories, by server id; `ACCOUNT_LAST_ACTIVE`/`CATEGORY_IN_USE` swallowed, other failures surfaced | [guestUpload:632](../../mobile/src/services/guest/guestUpload.test.ts#L632)–[:735](../../mobile/src/services/guest/guestUpload.test.ts#L735) | Covered |
| TC-GST-17 | GST-US-02 | Server side of a resumed upload | Integration + Unit | A replayed create with the same `Idempotency-Key` returns the original row, not a duplicate, even while the first is in flight | [integration.ledger:180](../../server/test/integration.ledger.test.ts#L180), [idempotency.interceptor:53](../../server/test/idempotency.interceptor.test.ts#L53) | Covered |
| TC-GST-18 | GST-US-02 | Sign up as a guest with data, choose the wallet, finish, or decline | E2E | One candidate chosen automatically; data uploaded and then discarded locally; declining keeps it and asks again later | — | Gap |

## Gaps, by risk

1. **TC-GST-18**: the wallet-choice and discard-after-success flow is UI logic with no test at any layer.
2. **TC-GST-09**: "survives relaunch" is a product promise asserted only at store level.
3. **TC-GST-08**: the per-endpoint guest routing in `app/store/api/*Api.ts` is untested; the guest service layer itself is proven network-free.
