# Test Cases: Transaction Management (TXN-US)

> **Feature:** SRS §7 TXN-US
> **Spec:** [spec.md](spec.md)
> **Plan:** [plan.md](plan.md)

Classification: **[API]** verifiable through the HTTP contract alone · **[UI]** only observable in the browser · **[BOTH]** needs both to be meaningful.

Endpoints under test:

| Operation | Endpoint |
|---|---|
| Record | `POST /api/v1/workspaces/{workspaceId}/transactions` |
| Transfer | `POST /api/v1/workspaces/{workspaceId}/transactions/transfer` |
| List | `GET /api/v1/workspaces/{workspaceId}/transactions` |
| Detail | `GET /api/v1/workspaces/{workspaceId}/transactions/{transactionId}` |
| Edit | `PUT /api/v1/workspaces/{workspaceId}/transactions/{transactionId}` |
| Cancel | `DELETE /api/v1/workspaces/{workspaceId}/transactions/{transactionId}` |

---

## TXN-US-01: Record Income Transaction

### AC Classification

| AC | Scenario | Classification |
|----|----------|----------------|
| AC-01 | Arriving transaction increases the balance | [BOTH] |
| AC-02 | INCOME, REFUND and DEBT all arrive | [API] |
| AC-03 | Amount positive, direction carries the sign | [API] |
| AC-04 | Record and balance change are indivisible | [API] |
| AC-05 | Currency taken from the account | [API] |
| AC-06 | No currency choice on the form | [UI] |
| AC-07 | Rate snapshotted on the row | [API] |
| AC-08 | Matching currency needs no rate | [API] |
| AC-09 | Conversion previewed | [UI] |
| AC-10 | Failed preview does not block | [UI] |
| AC-11 | Unobtainable rate refuses the write | [BOTH] |
| AC-12 | Zero or negative amount refused | [BOTH] |
| AC-13 | Excess decimal places refused | [API] |
| AC-14 | Excess magnitude refused | [API] |
| AC-15 | Unknown account refused as not found | [API] |
| AC-16 | Archived account refused as archived | [BOTH] |
| AC-17 | Account of another workspace reads as absent | [API] |
| AC-18 | Category of another workspace refused | [API] |
| AC-19 | No category is allowed, shown as unclassified | [BOTH] |
| AC-20 | Only matching-direction categories offered | [UI] |
| AC-21 | Date required, future date accepted | [BOTH] |
| AC-22 | Optional detail stored verbatim | [API] |
| AC-23 | Non-member cannot record | [API] |
| AC-24 | Every attempt audited | [API] |
| EC-001 | Account archived after the form opened | [API] |
| EC-009 | Membership removed while the form is open | [API] |
| EC-010 | Form submitted twice in quick succession | [UI] |
| EC-011 | Converted figure exceeds reported precision | [API] |
| EC-012 | Recording against an already-negative balance | [API] |

### Coverage Matrix

| AC | Label | Integration TC(s) | E2E TC(s) |
|----|-------|-------------------|-----------|
| AC-01 | Balance increases | TC-01 | TC-02 |
| AC-02 | Arriving types | TC-03 | — |
| AC-03 | Positive amount, stored direction | TC-04 | — |
| AC-04 | Atomicity | TC-05 | — |
| AC-05 | Currency from account | TC-06 | — |
| AC-06 | No currency field | — | TC-07 |
| AC-07 | Rate snapshotted | TC-08 | — |
| AC-08 | No rate needed | TC-09 | — |
| AC-09 | Preview shown | — | TC-10 |
| AC-10 | Preview failure tolerated | — | TC-11 |
| AC-11 | Rate unavailable | TC-12 | TC-13 |
| AC-12 | Non-positive amount | TC-14 | TC-15 |
| AC-13 | Too many decimals | TC-16 | — |
| AC-14 | Too many digits | TC-17 | — |
| AC-15 | Unknown account | TC-18 | — |
| AC-16 | Archived account | TC-19 | TC-20 |
| AC-17 | Foreign-workspace account | TC-21 | — |
| AC-18 | Foreign-workspace category | TC-22 | — |
| AC-19 | Unclassified allowed | TC-23 | TC-24 |
| AC-20 | Category list follows type | — | TC-25 |
| AC-21 | Date rules | TC-26 | TC-27 |
| AC-22 | Optional detail | TC-28 | — |
| AC-23 | Non-member refused | TC-29 | — |
| AC-24 | Audited | TC-30, TC-31 | — |
| EC-001 | Archived mid-form | TC-32 | — |
| EC-009 | Membership removed mid-form | TC-33 | — |
| EC-010 | Double submit | — | TC-34 |
| EC-011 | Conversion precision | TC-35 | — |
| EC-012 | Negative starting balance | TC-36 | — |

---

### TC-01: An income transaction increases its account's balance by the amount

- **US:** TXN-US-01
- **Given:** An active account with a balance of `1000.00`
- **When:** `POST .../transactions` with `type: INCOME`, `amount: 250.00`, today's date
- **Then:** 201 with the envelope carrying the transaction; the stored account balance is `1250.00`
- **AC:** AC-01
- **Type:** integration

### TC-02: A member can record income through the form and see it in the list

- **US:** TXN-US-01
- **Given:** The transactions page is open with at least one account
- **When:** `btn-add-transaction` is pressed, `type-transaction` set to `INCOME`, `amount-transaction` filled, `btn-submit-transaction` pressed
- **Then:** `modal-transaction` closes and a row for the new amount appears inside today's `section-transactions-{today}` with a `+` sign
- **AC:** AC-01
- **Type:** e2e

### TC-03: INCOME, REFUND and DEBT each increase the balance

- **US:** TXN-US-01
- **Given:** Three active accounts each with a balance of `100.00`
- **When:** One `INCOME`, one `REFUND` and one `DEBT` of `10.00` are recorded, one per account
- **Then:** All three balances are `110.00`, and each stored row keeps its own `type`
- **AC:** AC-02
- **Type:** integration

### TC-04: The stored amount is positive and the direction carries the sign

- **US:** TXN-US-01
- **Given:** An active account
- **When:** An `INCOME` of `75.50` is recorded
- **Then:** The stored row has `amount = 75.50` and `direction = 'credit'`; no negative amount is stored anywhere
- **AC:** AC-03
- **Type:** integration

### TC-05: A failure during recording leaves neither a row nor a balance change

- **US:** TXN-US-01
- **Given:** An active account with balance `500.00`, and the balance adjustment made to fail
- **When:** A recording is attempted
- **Then:** The request fails, the transaction count for the workspace is unchanged, and the balance is still `500.00`
- **AC:** AC-04
- **Type:** integration

### TC-06: The transaction takes the account's currency, not one supplied by the client

- **US:** TXN-US-01
- **Given:** An account denominated in `VND` in a workspace reporting in `USD`
- **When:** A transaction is recorded, with a `currency` field added to the body
- **Then:** 201; the stored row's currency is `VND`; the supplied field is ignored and is absent from the request contract
- **AC:** AC-05
- **Type:** integration

### TC-07: The recording form offers no currency choice

- **US:** TXN-US-01
- **Given:** `modal-transaction` is open
- **When:** Its fields are enumerated
- **Then:** No currency control exists; the currency appears only as the suffix of the `amount-transaction` label and beside each option of `account-transaction`
- **AC:** AC-06
- **Type:** e2e

### TC-08: A cross-currency transaction stores the rate that applied when it was recorded

- **US:** TXN-US-01
- **Given:** A workspace reporting in `USD` and an account in `VND`
- **When:** An `INCOME` of `1,000,000` VND is recorded
- **Then:** 201; the stored row carries a positive `exchange_rate` and a `base_amount` equal to `amount × exchange_rate`; changing the rate source afterwards leaves both unchanged
- **AC:** AC-07
- **Type:** integration

### TC-09: An account in the reporting currency stores a rate of exactly one with no external call

- **US:** TXN-US-01
- **Given:** A workspace reporting in `USD` and an account in `USD`, with the rate provider instrumented
- **When:** A transaction is recorded
- **Then:** The stored `exchange_rate` is exactly `1`, `base_amount` equals `amount`, and the provider was not called
- **AC:** AC-08
- **Type:** integration

### TC-10: The dialog previews the rate and the converted amount

- **US:** TXN-US-01
- **Given:** A workspace reporting in `USD`, `account-transaction` set to a `VND` account
- **When:** `amount-transaction` is filled with `1000000`
- **Then:** `rate-preview-transaction` shows `1 VND = <rate> USD` and the converted figure, with no editable rate control anywhere in the dialog
- **AC:** AC-09
- **Type:** e2e

### TC-11: A preview that cannot be fetched warns but still allows submission

- **US:** TXN-US-01
- **Given:** The rate read is made to fail, with a `VND` account selected in a `USD` workspace
- **When:** The dialog renders and the form is submitted
- **Then:** `rate-preview-transaction` shows the rate-unavailable warning, `btn-submit-transaction` stays enabled, and the submission proceeds
- **AC:** AC-10
- **Type:** e2e

### TC-12: A rate that cannot be obtained refuses the write and moves no balance

- **US:** TXN-US-01
- **Given:** A `VND` account in a `USD` workspace, balance `500.00`, every rate source unavailable including the cache and the configured fallback
- **When:** `POST .../transactions`
- **Then:** 503 with `error_code: EXCHANGE_RATE_UNAVAILABLE`; the transaction count is unchanged and the balance is still `500.00`
- **AC:** AC-11
- **Type:** integration

### TC-13: The form reports an unavailable rate without losing the entered values

- **US:** TXN-US-01
- **Given:** The recording endpoint returns `EXCHANGE_RATE_UNAVAILABLE`
- **When:** The form is submitted
- **Then:** An error alert inside `modal-transaction` states the rate is unavailable, the dialog stays open, and `amount-transaction` still holds what was typed
- **AC:** AC-11
- **Type:** e2e

### TC-14: An amount of zero or below is refused

- **US:** TXN-US-01
- **Given:** An active account
- **When:** `POST .../transactions` with `amount: 0`, then with `amount: -5.00`
- **Then:** Both return 422 naming the `amount` field; no transaction is created and the balance is unchanged. The service-level `INVALID_AMOUNT` guard remains as defence in depth behind the request contract
- **AC:** AC-12
- **Type:** integration

### TC-15: The form refuses a non-positive amount before submitting

- **US:** TXN-US-01
- **Given:** `modal-transaction` is open
- **When:** `amount-transaction` is set to `0` and `btn-submit-transaction` is pressed
- **Then:** An inline error appears beneath the amount field and no request is sent
- **AC:** AC-12
- **Type:** e2e

### TC-16: An amount with three decimal places is refused

- **US:** TXN-US-01
- **Given:** An active account
- **When:** `POST .../transactions` with `amount: 10.005`
- **Then:** 422 naming the `amount` field; nothing is stored and no rounding occurs
- **AC:** AC-13
- **Type:** integration

### TC-17: An amount beyond the stored magnitude is refused

- **US:** TXN-US-01
- **Given:** An active account
- **When:** `POST .../transactions` with an amount of sixteen integer digits
- **Then:** 422 naming the `amount` field; nothing is stored
- **AC:** AC-14
- **Type:** integration

### TC-18: An unknown account is refused as not found

- **US:** TXN-US-01
- **Given:** No account with id `999999`
- **When:** `POST .../transactions` with `account_id: 999999`
- **Then:** 404 with `error_code: ACCOUNT_NOT_FOUND`; nothing is stored
- **AC:** AC-15
- **Type:** integration

### TC-19: An archived account is refused as archived, distinguishably

- **US:** TXN-US-01
- **Given:** An archived account
- **When:** `POST .../transactions` against it
- **Then:** 409 with `error_code: ACCOUNT_ARCHIVED` — not `ACCOUNT_NOT_FOUND` — and nothing is stored
- **AC:** AC-16
- **Type:** integration

### TC-20: The form reports an archived account rather than a generic failure

- **US:** TXN-US-01
- **Given:** The recording endpoint returns `ACCOUNT_ARCHIVED`
- **When:** The form is submitted
- **Then:** An error alert appears in `modal-transaction` and the dialog stays open
- **AC:** AC-16
- **Type:** e2e

### TC-21: An account belonging to another workspace reads as not found

- **US:** TXN-US-01
- **Given:** Two workspaces, each with an account, the caller a member of the first only
- **When:** `POST .../workspaces/{first}/transactions` naming the second workspace's account
- **Then:** 404 with `error_code: ACCOUNT_NOT_FOUND`, revealing nothing about the other workspace
- **AC:** AC-17
- **Type:** integration

### TC-22: A category belonging to another workspace is refused

- **US:** TXN-US-01
- **Given:** A category in a different workspace
- **When:** `POST .../transactions` naming that category
- **Then:** 404 with `error_code: CATEGORY_NOT_FOUND`; nothing is stored
- **AC:** AC-18
- **Type:** integration

### TC-23: A transaction with no category is accepted

- **US:** TXN-US-01
- **Given:** An active account
- **When:** `POST .../transactions` with `category_id` absent
- **Then:** 201; the stored row has no category and the response carries `category_id: null` and `category_name: null`
- **AC:** AC-19
- **Type:** integration

### TC-24: An unclassified row is labelled, not left blank

- **US:** TXN-US-01
- **Given:** A recorded transaction with no category
- **When:** The history renders
- **Then:** The row's leading element reads as uncategorised rather than being empty
- **AC:** AC-19
- **Type:** e2e

### TC-25: The category list follows the chosen type

- **US:** TXN-US-01
- **Given:** The workspace has both arriving-side and leaving-side categories
- **When:** `type-transaction` is set to `INCOME`, then to `EXPENSE`
- **Then:** `category-transaction` offers only arriving-side options in the first case and only leaving-side options in the second
- **AC:** AC-20
- **Type:** e2e

### TC-26: A future date is accepted and a missing date is refused

- **US:** TXN-US-01
- **Given:** An active account
- **When:** A transaction is recorded dated one month ahead, then one is submitted with `date` absent
- **Then:** The first returns 201 and stores that date; the second returns 422 naming the `date` field
- **AC:** AC-21
- **Type:** integration

### TC-27: The form defaults to today and accepts a later date

- **US:** TXN-US-01
- **Given:** `modal-transaction` is open for a new transaction
- **When:** `date-transaction` is read, then set to a future date and submitted
- **Then:** It initially holds today's date, and the submission succeeds
- **AC:** AC-21
- **Type:** e2e

### TC-28: Optional detail is stored and returned verbatim

- **US:** TXN-US-01
- **Given:** An active account
- **When:** A transaction is recorded with a description, notes, tags, a receipt reference and a location
- **Then:** 201; each value is returned exactly as sent, and a second transaction omitting all of them is equally accepted with each field null
- **AC:** AC-22
- **Type:** integration

### TC-29: A non-member cannot record, and an unknown workspace is not found

- **US:** TXN-US-01
- **Given:** A workspace the caller is not a member of, and an id matching no workspace
- **When:** `POST .../transactions` against each
- **Then:** 403 with `PERMISSION_DENIED` for the first and 404 with `WORKSPACE_NOT_FOUND` for the second; nothing is stored in either case
- **AC:** AC-23
- **Type:** integration

### TC-30: A successful recording writes an audit record

- **US:** TXN-US-01
- **Given:** An active account
- **When:** A transaction is recorded
- **Then:** An audit row exists with `event_name: TXN_AUDIT`, `action: event=TXN_CREATE`, `result: success`, the actor's id, the transaction and account ids, and the source address
- **AC:** AC-24
- **Type:** integration

### TC-31: A refused recording writes a failure audit record carrying the reason

- **US:** TXN-US-01
- **Given:** An archived account
- **When:** A recording is attempted against it
- **Then:** An audit row exists with `result: failure` and `error_code: ACCOUNT_ARCHIVED`
- **AC:** AC-24
- **Type:** integration

### TC-32: An account archived after the form was opened refuses the submission

- **US:** TXN-US-01
- **Given:** An account that is active when the payload is prepared and archived before it is sent
- **When:** `POST .../transactions`
- **Then:** 409 with `ACCOUNT_ARCHIVED`; nothing is stored, so the check is made at submission rather than at form load
- **AC:** EC-001
- **Type:** integration

### TC-33: Membership removed while the form is open refuses the submission

- **US:** TXN-US-01
- **Given:** A member whose membership is removed after their form loaded
- **When:** They submit a recording
- **Then:** 403 with `PERMISSION_DENIED`; nothing is stored
- **AC:** EC-009
- **Type:** integration

### TC-34: Pressing submit twice records one transaction

- **US:** TXN-US-01
- **Given:** `modal-transaction` filled in, with the network slowed
- **When:** `btn-submit-transaction` is pressed twice in quick succession
- **Then:** The control is disabled after the first press and exactly one transaction appears in the list
- **AC:** EC-010
- **Type:** e2e

### TC-35: A conversion needing more precision than the reported figure holds is stored without error

- **US:** TXN-US-01
- **Given:** A `VND` account in a `USD` workspace and an amount whose conversion yields a long fraction
- **When:** The transaction is recorded
- **Then:** 201; the reported figure is stored at the column's precision and no overflow or error occurs
- **AC:** EC-011
- **Type:** integration

### TC-36: Recording against a negative balance works normally

- **US:** TXN-US-01
- **Given:** An account whose balance is `-50.00`
- **When:** An `INCOME` of `20.00` is recorded
- **Then:** 201 and the balance becomes `-30.00`
- **AC:** EC-012
- **Type:** integration

---

## TXN-US-02: Record Expense Transaction

### AC Classification

| AC | Scenario | Classification |
|----|----------|----------------|
| AC-25 | Leaving transaction decreases the balance | [BOTH] |
| AC-26 | EXPENSE, INVESTMENT and LOAN all leave | [API] |
| AC-27 | Borrowed in rises, lent out falls | [API] |
| AC-28 | An expense may go below zero | [API] |
| AC-29 | Leaving amount still stored positive | [API] |
| AC-30 | Own currency leads, equivalent alongside | [UI] |
| AC-31 | Leaving-side categories only | [UI] |
| AC-32 | Archived account refuses an expense | [API] |
| AC-33 | Summaries include it immediately | [API] |
| AC-34 | The row reads as an outflow | [UI] |
| AC-35 | Transfer absent from the type list | [UI] |
| AC-36 | Transfer refused as an ordinary recording | [API] |
| AC-37 | Rate failure stores nothing | [API] |
| AC-38 | A refusal keeps the input | [UI] |
| AC-39 | Double submission prevented | [UI] |
| AC-40 | Busy state shown | [UI] |
| AC-41 | Success closes and refreshes | [UI] |
| AC-42 | The row names who recorded it | [API] |
| AC-43 | Audited | [API] |
| AC-44 | Refused after membership removal | [API] |

### Coverage Matrix

| AC | Label | Integration TC(s) | E2E TC(s) |
|----|-------|-------------------|-----------|
| AC-25 | Balance decreases | TC-37 | TC-38 |
| AC-26 | Leaving types | TC-39 | — |
| AC-27 | DEBT versus LOAN | TC-40 | — |
| AC-28 | Below zero allowed | TC-41 | — |
| AC-29 | Positive storage | TC-42 | — |
| AC-30 | Own currency leads | — | TC-43 |
| AC-31 | Expense categories | — | TC-44 |
| AC-32 | Archived account | TC-45 | — |
| AC-33 | Summaries updated | TC-46 | — |
| AC-34 | Outflow presentation | — | TC-47 |
| AC-35 | No transfer option | — | TC-48 |
| AC-36 | Transfer type refused | TC-49 | — |
| AC-37 | Rate failure | TC-50 | — |
| AC-38 | Input preserved | — | TC-51 |
| AC-39 | Single submission | — | TC-52 |
| AC-40 | Busy state | — | TC-53 |
| AC-41 | Close and refresh | — | TC-54 |
| AC-42 | Recorded by | TC-55 | — |
| AC-43 | Audited | TC-56 | — |
| AC-44 | Membership removed | TC-57 | — |

---

### TC-37: An expense decreases its account's balance by the amount

- **US:** TXN-US-02
- **Given:** An active account with a balance of `1000.00`
- **When:** `POST .../transactions` with `type: EXPENSE`, `amount: 250.00`
- **Then:** 201; the stored balance is `750.00` and the row's `direction` is `debit`
- **AC:** AC-25
- **Type:** integration

### TC-38: A member can record an expense through the form

- **US:** TXN-US-02
- **Given:** The transactions page is open
- **When:** An `EXPENSE` is recorded through `modal-transaction`
- **Then:** The dialog closes and the new row appears with a `−` sign in today's section
- **AC:** AC-25
- **Type:** e2e

### TC-39: EXPENSE, INVESTMENT and LOAN each decrease the balance

- **US:** TXN-US-02
- **Given:** Three active accounts each with a balance of `100.00`
- **When:** One `EXPENSE`, one `INVESTMENT` and one `LOAN` of `10.00` are recorded, one per account
- **Then:** All three balances are `90.00`, and each row keeps its own type
- **AC:** AC-26
- **Type:** integration

### TC-40: Borrowing increases and lending decreases

- **US:** TXN-US-02
- **Given:** Two active accounts each with a balance of `100.00`
- **When:** A `DEBT` of `40.00` is recorded against the first and a `LOAN` of `40.00` against the second
- **Then:** The first balance is `140.00` with `direction: credit`; the second is `60.00` with `direction: debit`
- **AC:** AC-27
- **Type:** integration

### TC-41: An expense larger than the balance is accepted

- **US:** TXN-US-02
- **Given:** An account with a balance of `10.00`
- **When:** An `EXPENSE` of `100.00` is recorded
- **Then:** 201 and the balance becomes `-90.00`; no `INSUFFICIENT_BALANCE` refusal occurs
- **AC:** AC-28
- **Type:** integration

### TC-42: An expense stores a positive amount

- **US:** TXN-US-02
- **Given:** An active account
- **When:** An `EXPENSE` of `33.33` is recorded
- **Then:** The stored `amount` is `33.33`, not `-33.33`, and the sign lives only in `direction`
- **AC:** AC-29
- **Type:** integration

### TC-43: A foreign-currency row leads with its own currency

- **US:** TXN-US-02
- **Given:** A `USD` workspace containing a `VND` account with a recorded expense
- **When:** The history renders
- **Then:** The row's principal figure is in `VND` and a secondary line shows the `USD` equivalent prefixed with `≈`
- **AC:** AC-30
- **Type:** e2e

### TC-44: The expense form offers only leaving-side categories

- **US:** TXN-US-02
- **Given:** `modal-transaction` open with `type-transaction` set to `EXPENSE`
- **When:** `category-transaction` is enumerated
- **Then:** Every option is a leaving-side category
- **AC:** AC-31
- **Type:** e2e

### TC-45: An archived account refuses an expense

- **US:** TXN-US-02
- **Given:** An archived account with a balance of `500.00`
- **When:** An expense is submitted against it
- **Then:** 409 with `ACCOUNT_ARCHIVED`; the balance is unchanged
- **AC:** AC-32
- **Type:** integration

### TC-46: A newly recorded expense appears in the summaries at once

- **US:** TXN-US-02
- **Given:** A workspace whose dashboard summary has been read
- **When:** An `EXPENSE` of `100.00` is recorded and the summary is read again
- **Then:** The all-time and current-month expense figures have each risen by the reported equivalent of `100.00`
- **AC:** AC-33
- **Type:** integration

### TC-47: An expense row is visually distinct from an income row

- **US:** TXN-US-02
- **Given:** One income and one expense on the same day
- **When:** The section renders
- **Then:** The income amount carries `+` in the arriving colour and the expense carries `−` in the neutral/leaving colour
- **AC:** AC-34
- **Type:** e2e

### TC-48: The recording form does not offer transfer as a type

- **US:** TXN-US-02
- **Given:** `modal-transaction` is open
- **When:** `type-transaction` options are enumerated
- **Then:** `TRANSFER` is absent, while the list filter `search-type` does offer it for filtering
- **AC:** AC-35
- **Type:** e2e

### TC-49: A transfer submitted as an ordinary recording is refused

- **US:** TXN-US-02
- **Given:** An active account
- **When:** `POST .../transactions` with `type: TRANSFER`
- **Then:** 400 with `error_code: INVALID_TRANSFER`; no one-sided transfer exists
- **AC:** AC-36
- **Type:** integration

### TC-50: A rate failure refuses an expense with nothing stored

- **US:** TXN-US-02
- **Given:** A `VND` account in a `USD` workspace with every rate source unavailable
- **When:** An expense is submitted
- **Then:** 503 with `EXCHANGE_RATE_UNAVAILABLE`; the transaction count and the balance are unchanged
- **AC:** AC-37
- **Type:** integration

### TC-51: A refusal leaves the form filled in

- **US:** TXN-US-02
- **Given:** The endpoint is made to refuse the submission
- **When:** The form is submitted
- **Then:** `modal-transaction` stays open showing an error alert, and every field still holds what was entered
- **AC:** AC-38
- **Type:** e2e

### TC-52: A second submission while the first is in flight is ignored

- **US:** TXN-US-02
- **Given:** A slowed network and a filled form
- **When:** `btn-submit-transaction` is pressed repeatedly
- **Then:** Only one request is issued and one row results
- **AC:** AC-39
- **Type:** e2e

### TC-53: The dialog shows it is working and cannot be dismissed mid-flight

- **US:** TXN-US-02
- **Given:** A slowed network
- **When:** The form is submitted
- **Then:** `btn-submit-transaction` shows its loading state, `btn-cancel-transaction` is disabled, and the dialog does not close on an outside click
- **AC:** AC-40
- **Type:** e2e

### TC-54: A successful recording closes the dialog and refreshes the list

- **US:** TXN-US-02
- **Given:** A filled form
- **When:** It is submitted successfully
- **Then:** `modal-transaction` is no longer present and `table-transactions` contains the new row without a page reload
- **AC:** AC-41
- **Type:** e2e

### TC-55: The stored row names who recorded it and when

- **US:** TXN-US-02
- **Given:** A member records a transaction
- **When:** The stored row is read
- **Then:** `created_by` is that member's id and `created_at` is set
- **AC:** AC-42
- **Type:** integration

### TC-56: An expense recording is audited

- **US:** TXN-US-02
- **Given:** An active account
- **When:** An expense is recorded
- **Then:** An audit row exists with `event=TXN_CREATE`, `result: success`, and the account and transaction ids
- **AC:** AC-43
- **Type:** integration

### TC-57: A removed member cannot record even with a valid session

- **US:** TXN-US-02
- **Given:** A member removed from the workspace, holding a still-valid session
- **When:** They submit an expense
- **Then:** 403 with `PERMISSION_DENIED`, and a failure audit row is written
- **AC:** AC-44
- **Type:** integration

---

## TXN-US-03: Record Transfer Transaction

### AC Classification

| AC | Scenario | Classification |
|----|----------|----------------|
| AC-45 | One operation, linked pair | [API] |
| AC-46 | Each side states its direction | [API] |
| AC-47 | Source falls, destination rises | [API] |
| AC-48 | One shared link | [API] |
| AC-49 | Same date on both sides | [API] |
| AC-50 | Excluded from workspace flows | [API] |
| AC-51 | Included in per-account figures | [API] |
| AC-52 | Same-currency transfer moves the same figure | [API] |
| AC-53 | Cross-currency credits equivalent value | [API] |
| AC-54 | Each side carries its own rate | [API] |
| AC-55 | Total position unchanged | [API] |
| AC-56 | Credit rounded to the minor unit | [API] |
| AC-57 | Self-transfer refused | [API] |
| AC-58 | Unknown account refused | [API] |
| AC-59 | Archived account refused | [API] |
| AC-60 | Non-positive amount refused | [API] |
| AC-61 | Rate failure refuses both sides | [API] |
| AC-62 | Mid-way failure leaves nothing | [API] |
| AC-63 | No category on either side | [API] |
| AC-64 | Default description names the other account | [API] |
| AC-65 | Audited as one event | [API] |
| AC-66 | Distinct operation (no UI yet) | [API] |
| EC-002 | One account archived after the form opened | [API] |
| EC-006 | Rounding leaves the sides unequal in reported value | [API] |
| EC-015 | Each side intelligible alone | [API] |

### Coverage Matrix

| AC | Label | Integration TC(s) | E2E TC(s) |
|----|-------|-------------------|-----------|
| AC-45 | Linked pair | TC-58 | — |
| AC-46 | Direction per side | TC-59 | — |
| AC-47 | Balances move | TC-60 | — |
| AC-48 | Shared link | TC-61 | — |
| AC-49 | Shared date | TC-62 | — |
| AC-50 | Not income or expense | TC-63 | — |
| AC-51 | In per-account figures | TC-64 | — |
| AC-52 | Same currency | TC-65 | — |
| AC-53 | Cross currency | TC-66 | — |
| AC-54 | Own rate per side | TC-67 | — |
| AC-55 | Position preserved | TC-68 | — |
| AC-56 | Rounding | TC-69 | — |
| AC-57 | Self-transfer | TC-70 | — |
| AC-58 | Unknown account | TC-71 | — |
| AC-59 | Archived account | TC-72 | — |
| AC-60 | Non-positive amount | TC-73 | — |
| AC-61 | Rate failure | TC-74 | — |
| AC-62 | Partial failure | TC-75 | — |
| AC-63 | No category | TC-76 | — |
| AC-64 | Default descriptions | TC-77 | — |
| AC-65 | Audit | TC-78, TC-79 | — |
| AC-66 | Separate operation | TC-80 | — |
| EC-002 | Archived mid-form | TC-81 | — |
| EC-006 | Unequal reported sides | TC-82 | — |
| EC-015 | Side read alone | TC-83 | — |

---

### TC-58: A transfer creates exactly two linked transactions

- **US:** TXN-US-03
- **Given:** Two active accounts in the same workspace
- **When:** `POST .../transactions/transfer` with a source, a destination, `amount: 100.00` and a date
- **Then:** 201; the response carries `transfer_group_id`, a `debit` and a `credit`; exactly two transactions of type `TRANSFER` exist for that group
- **AC:** AC-45
- **Type:** integration

### TC-59: Each side of a transfer states its own direction

- **US:** TXN-US-03
- **Given:** A recorded transfer
- **When:** Each row is read individually
- **Then:** The source row has `direction: debit` and the destination row `direction: credit`, with no reference to ids or insertion order needed to tell them apart
- **AC:** AC-46
- **Type:** integration

### TC-60: The source balance falls and the destination balance rises

- **US:** TXN-US-03
- **Given:** Two same-currency accounts with balances `500.00` and `100.00`
- **When:** `100.00` is transferred from the first to the second
- **Then:** The balances become `400.00` and `200.00`
- **AC:** AC-47
- **Type:** integration

### TC-61: Both sides share one link that identifies nothing else

- **US:** TXN-US-03
- **Given:** Two transfers recorded in the same workspace
- **When:** The four rows are read
- **Then:** Each pair shares a `transfer_group_id`, the two group values differ, and no non-transfer row carries a group value
- **AC:** AC-48
- **Type:** integration

### TC-62: Both sides fall on the date given

- **US:** TXN-US-03
- **Given:** A transfer dated three days ago
- **When:** Both rows are read
- **Then:** Both carry that date, so the pair never straddles two day sections
- **AC:** AC-49
- **Type:** integration

### TC-63: A transfer changes no workspace income or expense figure

- **US:** TXN-US-03
- **Given:** A workspace whose summary income and expense are recorded
- **When:** A transfer is recorded between two of its accounts and the summary is read again
- **Then:** All-time, monthly and daily income and expense are all unchanged
- **AC:** AC-50
- **Type:** integration

### TC-64: Each account's own figures reflect its side of the transfer

- **US:** TXN-US-03
- **Given:** The same transfer
- **When:** The per-account section of the summary is read
- **Then:** The source's reported balance has fallen and the destination's has risen by the corresponding reported values
- **AC:** AC-51
- **Type:** integration

### TC-65: A same-currency transfer credits the identical figure

- **US:** TXN-US-03
- **Given:** Two `USD` accounts in a `USD` workspace
- **When:** `250.00` is transferred
- **Then:** The debit and credit rows both carry `amount: 250.00` and a rate of exactly `1`
- **AC:** AC-52
- **Type:** integration

### TC-66: A cross-currency transfer credits equivalent value, not the same numeral

- **US:** TXN-US-03
- **Given:** A `USD` account and a `VND` account in a `USD` workspace, with a known rate
- **When:** `100.00` is transferred from the `USD` account to the `VND` account
- **Then:** The credit row's amount is the `VND` equivalent of `100 USD` — emphatically not `100` — and its currency is `VND`
- **AC:** AC-53
- **Type:** integration

### TC-67: Each side carries the rate of its own account's currency

- **US:** TXN-US-03
- **Given:** The same cross-currency transfer in a `USD` workspace
- **When:** Both rows are read
- **Then:** The `USD` side's rate is `1` and the `VND` side's rate is the `VND`-to-`USD` rate
- **AC:** AC-54
- **Type:** integration

### TC-68: A cross-currency transfer leaves the workspace's total position unchanged

- **US:** TXN-US-03
- **Given:** The reported total balance before the transfer
- **When:** A cross-currency transfer is recorded and the total is read again
- **Then:** It is the same within one minor unit
- **AC:** AC-55
- **Type:** integration

### TC-69: The credited figure is rounded to two decimal places

- **US:** TXN-US-03
- **Given:** A conversion whose exact result carries more than two decimals
- **When:** The transfer is recorded
- **Then:** The credit amount has at most two decimal places, and the difference from the exact conversion is under one minor unit
- **AC:** AC-56
- **Type:** integration

### TC-70: A transfer to the same account is refused

- **US:** TXN-US-03
- **Given:** One active account
- **When:** `POST .../transactions/transfer` with the same id as source and destination
- **Then:** 400 with `INVALID_TRANSFER`; no rows are created and no balance moves
- **AC:** AC-57
- **Type:** integration

### TC-71: An unknown account on either side refuses the transfer

- **US:** TXN-US-03
- **Given:** One valid account and an id matching nothing
- **When:** The unknown id is used as the source, then as the destination
- **Then:** Both attempts return 404 with `ACCOUNT_NOT_FOUND`, and no row is created either time
- **AC:** AC-58
- **Type:** integration

### TC-72: An archived account on either side refuses the transfer

- **US:** TXN-US-03
- **Given:** One active and one archived account
- **When:** The archived one is used as the source, then as the destination
- **Then:** Both attempts return 409 with `ACCOUNT_ARCHIVED`, and neither side is created
- **AC:** AC-59
- **Type:** integration

### TC-73: A non-positive transfer amount is refused

- **US:** TXN-US-03
- **Given:** Two active accounts
- **When:** A transfer of `0`, then of `-10.00`, is submitted
- **Then:** Both return 422 naming the `amount` field; no rows are created
- **AC:** AC-60
- **Type:** integration

### TC-74: An unavailable rate for either account refuses the whole transfer

- **US:** TXN-US-03
- **Given:** A cross-currency pair with every rate source unavailable
- **When:** The transfer is submitted
- **Then:** 503 with `EXCHANGE_RATE_UNAVAILABLE`; neither row exists and neither balance moved
- **AC:** AC-61
- **Type:** integration

### TC-75: A failure after the first side is written leaves nothing behind

- **US:** TXN-US-03
- **Given:** The second insert made to fail
- **When:** A transfer is attempted
- **Then:** The request fails, no `TRANSFER` row exists for that group, and both balances are unchanged
- **AC:** AC-62
- **Type:** integration

### TC-76: Neither side of a transfer carries a category

- **US:** TXN-US-03
- **Given:** A recorded transfer
- **When:** Both rows are read
- **Then:** Both have `category_id: null`, and the request contract offers no category field
- **AC:** AC-63
- **Type:** integration

### TC-77: An undescribed transfer describes each side by the other account

- **US:** TXN-US-03
- **Given:** A transfer submitted with no description
- **When:** Both rows are read
- **Then:** The debit's description names the destination account and the credit's names the source account
- **AC:** AC-64
- **Type:** integration

### TC-78: A successful transfer writes one audit record naming both sides

- **US:** TXN-US-03
- **Given:** Two active accounts
- **When:** A transfer is recorded
- **Then:** One audit row exists with `event=TXN_TRANSFER`, `result: success`, both transaction ids and both account ids
- **AC:** AC-65
- **Type:** integration

### TC-79: A refused transfer writes a failure audit record

- **US:** TXN-US-03
- **Given:** The same account as source and destination
- **When:** The transfer is attempted
- **Then:** An audit row exists with `result: failure` and `error_code: INVALID_TRANSFER`
- **AC:** AC-65
- **Type:** integration

### TC-80: A transfer is reachable only through its own operation

- **US:** TXN-US-03
- **Given:** The API surface
- **When:** The recording and transfer endpoints are compared
- **Then:** The transfer endpoint requires two accounts, the recording endpoint refuses the transfer type, and no other path produces a `TRANSFER` row
- **AC:** AC-66
- **Type:** integration

### TC-81: An account archived between preparation and submission refuses the transfer

- **US:** TXN-US-03
- **Given:** Both accounts active when the payload is prepared, the destination archived before it is sent
- **When:** The transfer is submitted
- **Then:** 409 with `ACCOUNT_ARCHIVED`; neither side is created
- **AC:** EC-002
- **Type:** integration

### TC-82: A rounded cross-currency transfer's two sides differ in reported value by under one minor unit

- **US:** TXN-US-03
- **Given:** A cross-currency transfer whose conversion rounds
- **When:** Both rows' reported amounts are compared
- **Then:** They differ by less than one minor unit, and that difference is the only discrepancy in the workspace total
- **AC:** EC-006
- **Type:** integration

### TC-83: Either side of a transfer is intelligible read alone

- **US:** TXN-US-03
- **Given:** A recorded transfer
- **When:** Either row is fetched by its own id
- **Then:** It carries its account name, its direction, its own amount and currency, and a description naming the account at the other end
- **AC:** EC-015
- **Type:** integration

---

## TXN-US-04: View Transaction History

### AC Classification

| AC | Scenario | Classification |
|----|----------|----------------|
| AC-67 | Newest first | [BOTH] |
| AC-68 | Amount in the account's currency | [UI] |
| AC-69 | Equivalent only when it differs | [UI] |
| AC-70 | A section per calendar day | [UI] |
| AC-71 | Today and yesterday named | [UI] |
| AC-72 | Per-day subtotals | [UI] |
| AC-73 | Cancelled excluded from subtotals | [UI] |
| AC-74 | Cancelled visible and marked | [BOTH] |
| AC-75 | Category and type lead | [UI] |
| AC-76 | Description supports | [UI] |
| AC-77 | Date, account and note distinguishable | [UI] |
| AC-78 | Unclassified says so | [UI] |
| AC-79 | Filter by type | [BOTH] |
| AC-80 | Filter by account, category, amount, date, text | [API] |
| AC-81 | Inverted date range refused | [API] |
| AC-82 | Text search across free-text fields | [API] |
| AC-83 | Sorting limited to known fields | [API] |
| AC-84 | Pagination with a total | [API] |
| AC-85 | Page size bounded | [API] |
| AC-86 | Single transaction retrievable | [API] |
| AC-87 | Foreign-workspace transaction not retrievable | [API] |
| AC-88 | Empty history explains itself | [UI] |
| AC-89 | Non-member cannot read | [API] |
| EC-013 | A day of only cancelled rows | [UI] |
| EC-014 | Everything on one date | [UI] |
| EC-017 | A page beyond the last | [API] |
| EC-018 | Search text containing wildcards | [API] |

### Coverage Matrix

| AC | Label | Integration TC(s) | E2E TC(s) |
|----|-------|-------------------|-----------|
| AC-67 | Newest first | TC-84 | TC-85 |
| AC-68 | Own currency | — | TC-86 |
| AC-69 | Conditional equivalent | — | TC-87 |
| AC-70 | Day sections | — | TC-88 |
| AC-71 | Relative labels | — | TC-89 |
| AC-72 | Day subtotals | — | TC-90 |
| AC-73 | Cancelled excluded | — | TC-91 |
| AC-74 | Cancelled marked | TC-92 | TC-93 |
| AC-75 | Category and type lead | — | TC-94 |
| AC-76 | Description secondary | — | TC-95 |
| AC-77 | Meta identifiable | — | TC-96 |
| AC-78 | Unclassified label | — | TC-97 |
| AC-79 | Type filter | TC-98 | TC-99 |
| AC-80 | Other filters | TC-100, TC-101 | — |
| AC-81 | Inverted range | TC-102 | — |
| AC-82 | Search fields | TC-103 | — |
| AC-83 | Sorting | TC-104 | — |
| AC-84 | Pagination | TC-105 | — |
| AC-85 | Bounded page size | TC-106 | — |
| AC-86 | Detail read | TC-107 | — |
| AC-87 | Cross-workspace detail | TC-108 | — |
| AC-88 | Empty states | — | TC-109, TC-110 |
| AC-89 | Non-member read | TC-111 | — |
| EC-013 | All-cancelled day | — | TC-112 |
| EC-014 | Single day | — | TC-113 |
| EC-017 | Page past the end | TC-114 | — |
| EC-018 | Wildcard search text | TC-115 | — |

---

### TC-84: History is returned newest first

- **US:** TXN-US-04
- **Given:** Transactions dated today, yesterday and last week
- **When:** `GET .../transactions`
- **Then:** 200 and the rows are ordered by date descending
- **AC:** AC-67
- **Type:** integration

### TC-85: The list shows the most recent day first

- **US:** TXN-US-04
- **Given:** Transactions on three different dates
- **When:** `table-transactions` renders
- **Then:** The first `section-transactions-*` is the most recent date
- **AC:** AC-67
- **Type:** e2e

### TC-86: A row's amount is stated in its account's currency

- **US:** TXN-US-04
- **Given:** A `VND` account and a `USD` account, each with a transaction, in a `USD` workspace
- **When:** The list renders
- **Then:** The first row's principal figure is formatted as `VND` and the second's as `USD`
- **AC:** AC-68
- **Type:** e2e

### TC-87: The reported equivalent appears only for foreign rows

- **US:** TXN-US-04
- **Given:** The same two rows
- **When:** The list renders
- **Then:** The `VND` row carries an `≈` equivalent line and the `USD` row carries none
- **AC:** AC-69
- **Type:** e2e

### TC-88: History is divided into one section per calendar day

- **US:** TXN-US-04
- **Given:** Transactions on three distinct dates
- **When:** The list renders
- **Then:** Three `section-transactions-{date}` sections exist, each containing only that date's rows
- **AC:** AC-70
- **Type:** e2e

### TC-89: Today and yesterday are named as well as dated

- **US:** TXN-US-04
- **Given:** Transactions dated today, yesterday and a week ago
- **When:** The sections render
- **Then:** The first two headings carry the relative words alongside the formatted date and the third carries the date alone
- **AC:** AC-71
- **Type:** e2e

### TC-90: Each day heading carries that day's inflow and outflow

- **US:** TXN-US-04
- **Given:** A day with a `100` income and a `40` expense, both in the reporting currency
- **When:** The section renders
- **Then:** The heading shows `+100` and `−40` in the reporting currency; a day with only income shows the inflow alone, with no zero outflow
- **AC:** AC-72
- **Type:** e2e

### TC-91: A cancelled row does not contribute to its day's subtotal

- **US:** TXN-US-04
- **Given:** A day with a `100` income and a cancelled `500` income
- **When:** The section renders
- **Then:** The heading shows `+100`
- **AC:** AC-73
- **Type:** e2e

### TC-92: A cancelled transaction is still returned by the list

- **US:** TXN-US-04
- **Given:** One recorded and one cancelled transaction
- **When:** `GET .../transactions`
- **Then:** Both appear, the cancelled one with `status: cancelled`
- **AC:** AC-74
- **Type:** integration

### TC-93: A cancelled row is visibly marked and struck through

- **US:** TXN-US-04
- **Given:** A cancelled transaction
- **When:** The list renders
- **Then:** Its row carries a cancelled badge, its amount is struck through, and the row is dimmed
- **AC:** AC-74
- **Type:** e2e

### TC-94: The category and type lead each row

- **US:** TXN-US-04
- **Given:** A transaction with a category, a type and a description
- **When:** The row renders
- **Then:** The category name and the type badge are the first elements of the row's leading line, above the description
- **AC:** AC-75
- **Type:** e2e

### TC-95: The description sits beneath as secondary detail

- **US:** TXN-US-04
- **Given:** The same row
- **When:** It renders
- **Then:** The description appears below the leading line, in a smaller, lighter style than the category
- **AC:** AC-76
- **Type:** e2e

### TC-96: Date, account and note are separately identifiable

- **US:** TXN-US-04
- **Given:** A row carrying a date, an account name and a note
- **When:** It renders
- **Then:** Each appears as its own meta item with a distinct icon and an accessible label, and the note is styled apart from the account
- **AC:** AC-77
- **Type:** e2e

### TC-97: A row with no category reads as uncategorised

- **US:** TXN-US-04
- **Given:** A transaction with no category
- **When:** Its row renders
- **Then:** The leading position holds the uncategorised label rather than being empty
- **AC:** AC-78
- **Type:** e2e

### TC-98: Filtering by type returns only that type

- **US:** TXN-US-04
- **Given:** One `INCOME`, one `EXPENSE` and one `TRANSFER` pair
- **When:** `GET .../transactions?type=EXPENSE`
- **Then:** 200 with only the expense row, and `total` equal to 1
- **AC:** AC-79
- **Type:** integration

### TC-99: The type filter narrows the visible list

- **US:** TXN-US-04
- **Given:** A mixture of types in the list
- **When:** `search-type` is set to `INCOME`
- **Then:** Only income rows remain, and the count in the card heading matches
- **AC:** AC-79
- **Type:** e2e

### TC-100: Account, category and amount-range filters each narrow the result

- **US:** TXN-US-04
- **Given:** Transactions across two accounts, two categories and amounts from `5.00` to `500.00`
- **When:** Each of `account_id`, `category_id`, `min_amount` and `max_amount` is applied in turn
- **Then:** Each response contains only matching rows, and `total` matches the number returned across pages
- **AC:** AC-80
- **Type:** integration

### TC-101: Date range and text filters combine to narrow rather than widen

- **US:** TXN-US-04
- **Given:** Transactions spread over a month, some containing `groceries` in the description
- **When:** `start_date`, `end_date` and `search=groceries` are applied together
- **Then:** Only rows satisfying all three are returned, and the result is a subset of what each filter returns alone
- **AC:** AC-80
- **Type:** integration

### TC-102: A date range whose start is after its end is refused

- **US:** TXN-US-04
- **Given:** Any workspace
- **When:** `GET .../transactions?start_date=2026-08-01&end_date=2026-07-01`
- **Then:** 400 with `error_code: INVALID_DATE_RANGE`, rather than an empty list
- **AC:** AC-81
- **Type:** integration

### TC-103: Search matches description, notes and tags, ignoring case

- **US:** TXN-US-04
- **Given:** Three transactions carrying the word `Rent` in the description, in the notes, and in the tags respectively, and one carrying it in its category name only
- **When:** `GET .../transactions?search=rent`
- **Then:** The first three are returned and the fourth is not, confirming the documented field set
- **AC:** AC-82
- **Type:** integration

### TC-104: A supported sort field orders the result; an unsupported one does not fail

- **US:** TXN-US-04
- **Given:** Transactions with differing amounts and dates
- **When:** `sort_by=amount`, `sort_by=-amount`, `sort_by=type`, `sort_by=created_at` and `sort_by=nonsense` are each requested
- **Then:** The first four order by the named field in the direction asked; the last returns 200 ordered by date descending rather than an error — the documented fallback
- **AC:** AC-83
- **Type:** integration

### TC-105: Pagination returns a page, a total and whether more remain

- **US:** TXN-US-04
- **Given:** 30 recorded transactions
- **When:** `GET .../transactions?page=1&page_size=10`, then `page=3`
- **Then:** Each returns 10 rows with `total: 30` and `page` echoed; `has_more` is true on page 1 and false on page 3; no row appears on two pages
- **AC:** AC-84
- **Type:** integration

### TC-106: An out-of-range page size is brought within bounds and reported

- **US:** TXN-US-04
- **Given:** Any workspace
- **When:** `page_size=0`, `page_size=5000` and `page=-3` are requested
- **Then:** The responses report `page_size: 1`, `page_size: 1000` and `page: 1` respectively, with no error
- **AC:** AC-85
- **Type:** integration

### TC-107: A single transaction can be read with its names resolved

- **US:** TXN-US-04
- **Given:** A transaction with an account and a category
- **When:** `GET .../transactions/{id}`
- **Then:** 200 with `account_name` and `category_name` populated alongside the ids
- **AC:** AC-86
- **Type:** integration

### TC-108: A transaction of another workspace is not readable through this one

- **US:** TXN-US-04
- **Given:** A transaction in workspace B, the caller a member of workspace A
- **When:** `GET /workspaces/{A}/transactions/{B's transaction}`
- **Then:** 404 with `TRANSACTION_NOT_FOUND`
- **AC:** AC-87
- **Type:** integration

### TC-109: An empty history explains itself

- **US:** TXN-US-04
- **Given:** A workspace with one account and no transactions
- **When:** The page renders
- **Then:** `empty-transactions` is shown with its hint, and `btn-add-transaction` is enabled
- **AC:** AC-88
- **Type:** e2e

### TC-110: A workspace with no accounts asks for an account first

- **US:** TXN-US-04
- **Given:** A workspace with no accounts
- **When:** The page renders
- **Then:** `empty-transactions-no-account` is shown, `btn-goto-accounts` links to the accounts page, and `btn-add-transaction` is disabled with an explanatory title
- **AC:** AC-88
- **Type:** e2e

### TC-111: A non-member cannot read the history or a single transaction

- **US:** TXN-US-04
- **Given:** A workspace the caller is not a member of
- **When:** The list and the detail endpoints are each requested
- **Then:** Both return 403 with `PERMISSION_DENIED`, and a failure audit row is written for the list attempt
- **AC:** AC-89
- **Type:** integration

### TC-112: A day of nothing but cancelled rows shows no subtotal

- **US:** TXN-US-04
- **Given:** A date whose only two transactions are cancelled
- **When:** Its section renders
- **Then:** Both rows are listed and marked, and the heading shows neither an inflow nor an outflow figure
- **AC:** EC-013
- **Type:** e2e

### TC-113: A history entirely on one date renders as a single section

- **US:** TXN-US-04
- **Given:** Five transactions all dated today
- **When:** The list renders
- **Then:** Exactly one section exists, labelled as today, containing all five rows with the day's subtotal
- **AC:** EC-014
- **Type:** e2e

### TC-114: A page beyond the last returns an empty page, not an error

- **US:** TXN-US-04
- **Given:** 5 transactions
- **When:** `GET .../transactions?page=99&page_size=25`
- **Then:** 200 with no rows, `total: 5` and `has_more: false`
- **AC:** EC-017
- **Type:** integration

### TC-115: Search text containing a wildcard character behaves as documented

- **US:** TXN-US-04
- **Given:** Transactions described `50% off` and `plain`
- **When:** `GET .../transactions?search=50%25` and `search=%25`
- **Then:** The documented outcome is asserted. The current matching passes the text into a containment pattern without escaping, so a bare `%` matches every row; whether wildcards are escaped or treated as text is an open decision — see [plan.md](plan.md) G11
- **AC:** EC-018
- **Type:** integration

---

## TXN-US-05: Cancel Transaction

### AC Classification

| AC | Scenario | Classification |
|----|----------|----------------|
| AC-90 | Balance effect reversed | [BOTH] |
| AC-91 | Cancelled, not deleted | [API] |
| AC-92 | Cancellation time recorded | [API] |
| AC-93 | Reason recorded when given | [API] |
| AC-94 | Both halves cancel together | [API] |
| AC-95 | Either half is a valid start | [API] |
| AC-96 | Cross-currency reversal per account | [API] |
| AC-97 | Reversal follows stored direction | [API] |
| AC-98 | Creator may cancel | [API] |
| AC-99 | OWNER may cancel anyone's | [API] |
| AC-100 | Another member may not | [BOTH] |
| AC-101 | Double cancellation refused | [BOTH] |
| AC-102 | Cancelled cannot be edited | [API] |
| AC-103 | No reinstatement | [BOTH] |
| AC-104 | Confirmation identifies the transaction | [UI] |
| AC-105 | Confirmation can be abandoned | [UI] |
| AC-106 | Failure keeps the dialog open | [UI] |
| AC-107 | Cancelled row loses its controls | [UI] |
| AC-108 | Cancelled stops counting everywhere | [API] |
| AC-109 | Unknown transaction refused | [API] |
| AC-110 | Non-member refused | [API] |
| AC-111 | Audited | [API] |
| EC-005 | Two members cancel at once | [API] |

### Coverage Matrix

| AC | Label | Integration TC(s) | E2E TC(s) |
|----|-------|-------------------|-----------|
| AC-90 | Reversal | TC-116 | TC-117 |
| AC-91 | Not deleted | TC-118 | — |
| AC-92 | Time recorded | TC-119 | — |
| AC-93 | Reason recorded | TC-120 | — |
| AC-94 | Pair cancelled | TC-121 | — |
| AC-95 | Either half | TC-122 | — |
| AC-96 | Cross-currency reversal | TC-123 | — |
| AC-97 | Stored direction | TC-124 | — |
| AC-98 | Creator | TC-125 | — |
| AC-99 | OWNER | TC-126 | — |
| AC-100 | Other member | TC-127 | TC-128 |
| AC-101 | Twice | TC-129 | TC-130 |
| AC-102 | Edit after cancel | TC-131 | — |
| AC-103 | No reinstatement | TC-132 | TC-133 |
| AC-104 | Confirmation content | — | TC-134 |
| AC-105 | Abandonment | — | TC-135 |
| AC-106 | Failure handling | — | TC-136 |
| AC-107 | Controls removed | — | TC-137 |
| AC-108 | Excluded from figures | TC-138 | — |
| AC-109 | Unknown | TC-139 | — |
| AC-110 | Non-member | TC-140 | — |
| AC-111 | Audited | TC-141, TC-142 | — |
| EC-005 | Concurrent cancellation | TC-143 | — |

---

### TC-116: Cancelling restores the account balance

- **US:** TXN-US-05
- **Given:** An account with balance `1000.00` and a recorded `EXPENSE` of `250.00`, leaving `750.00`
- **When:** `DELETE .../transactions/{id}`
- **Then:** 200 and the balance is `1000.00` again
- **AC:** AC-90
- **Type:** integration

### TC-117: Cancelling from the list restores the balance shown

- **US:** TXN-US-05
- **Given:** A recorded expense and the account balance noted
- **When:** `btn-cancel-transaction-{id}` is pressed and confirmed
- **Then:** The row becomes cancelled and the accounts page shows the original balance
- **AC:** AC-90
- **Type:** e2e

### TC-118: A cancelled transaction still exists with its data intact

- **US:** TXN-US-05
- **Given:** A recorded transaction with an amount, a date and a category
- **When:** It is cancelled
- **Then:** The row still exists with `status: cancelled` and its amount, date and category unchanged; no row is removed from the table
- **AC:** AC-91
- **Type:** integration

### TC-119: The cancellation moment is stored

- **US:** TXN-US-05
- **Given:** A recorded transaction
- **When:** It is cancelled
- **Then:** `cancelled_at` is set to a time at or after the request
- **AC:** AC-92
- **Type:** integration

### TC-120: A reason is stored when supplied and optional when not

- **US:** TXN-US-05
- **Given:** Two recorded transactions
- **When:** One is cancelled with `reason: "duplicate entry"` and the other with no body
- **Then:** Both return 200; the first stores that reason and carries it in its audit record, the second stores none
- **AC:** AC-93
- **Type:** integration

### TC-121: Cancelling one side of a transfer cancels both

- **US:** TXN-US-05
- **Given:** A transfer between two accounts
- **When:** The debit side is cancelled
- **Then:** Both rows have `status: cancelled` and both balances are back to their pre-transfer values
- **AC:** AC-94
- **Type:** integration

### TC-122: Cancelling the credit side gives the same outcome as cancelling the debit side

- **US:** TXN-US-05
- **Given:** Two identical transfers in identical workspaces
- **When:** One is cancelled from its debit side and the other from its credit side
- **Then:** Both workspaces end with identical account balances and both pairs fully cancelled
- **AC:** AC-95
- **Type:** integration

### TC-123: A cross-currency transfer reverses each account by its own figure

- **US:** TXN-US-05
- **Given:** A transfer of `100.00 USD` credited as its `VND` equivalent
- **When:** It is cancelled
- **Then:** The `USD` account regains exactly `100.00` and the `VND` account loses exactly the credited `VND` figure
- **AC:** AC-96
- **Type:** integration

### TC-124: Reversal uses the stored direction, not the row order

- **US:** TXN-US-05
- **Given:** A transfer whose credit row has the lower id (constructed directly in the database)
- **When:** It is cancelled
- **Then:** Each account is still restored correctly, proving the reversal reads `direction` rather than inferring from ids
- **AC:** AC-97
- **Type:** integration

### TC-125: The creator may cancel their own transaction

- **US:** TXN-US-05
- **Given:** A transaction recorded by a non-owner member
- **When:** That same member cancels it
- **Then:** 200 and the transaction is cancelled
- **AC:** AC-98
- **Type:** integration

### TC-126: An OWNER may cancel a transaction recorded by another member

- **US:** TXN-US-05
- **Given:** A transaction recorded by a member
- **When:** The workspace OWNER cancels it
- **Then:** 200 and the transaction is cancelled
- **AC:** AC-99
- **Type:** integration

### TC-127: A member who is neither creator nor OWNER cannot cancel

- **US:** TXN-US-05
- **Given:** A transaction recorded by member A and a second non-owner member B
- **When:** B attempts to cancel it
- **Then:** 403 with `PERMISSION_DENIED`; the transaction is still recorded and the balance untouched
- **AC:** AC-100
- **Type:** integration

### TC-128: A refused cancellation surfaces as an error, not a silent success

- **US:** TXN-US-05
- **Given:** A session for a member without permission on the chosen row
- **When:** The cancellation is confirmed
- **Then:** `modal-confirm-cancel-transaction` stays open showing the error and the row is still uncancelled after a refresh
- **AC:** AC-100
- **Type:** e2e

### TC-129: Cancelling twice is refused and does not double-reverse

- **US:** TXN-US-05
- **Given:** An account at `1000.00` and a cancelled `250.00` expense
- **When:** `DELETE .../transactions/{id}` is called again
- **Then:** 409 with `TRANSACTION_ALREADY_CANCELLED` and the balance is still `1000.00`
- **AC:** AC-101
- **Type:** integration

### TC-130: A cancelled row offers no second cancellation

- **US:** TXN-US-05
- **Given:** A cancelled row in the list
- **When:** It renders
- **Then:** No `btn-cancel-transaction-{id}` exists for it, so a second cancellation cannot be started from the UI
- **AC:** AC-101
- **Type:** e2e

### TC-131: A cancelled transaction cannot be edited

- **US:** TXN-US-05
- **Given:** A cancelled transaction
- **When:** `PUT .../transactions/{id}` with a new category
- **Then:** 409 with `TRANSACTION_ALREADY_CANCELLED` and the stored category is unchanged
- **AC:** AC-102
- **Type:** integration

### TC-132: No endpoint reinstates a cancelled transaction

- **US:** TXN-US-05
- **Given:** A cancelled transaction
- **When:** The API surface is inspected for a reinstate or restore operation
- **Then:** None exists, and no request changes `status` back to recorded
- **AC:** AC-103
- **Type:** integration

### TC-133: The list offers no way to reinstate

- **US:** TXN-US-05
- **Given:** A cancelled row
- **When:** Its controls are enumerated
- **Then:** No restore control is present
- **AC:** AC-103
- **Type:** e2e

### TC-134: The confirmation identifies the transaction and warns

- **US:** TXN-US-05
- **Given:** A row dated yesterday for `250.00` described `Team lunch`
- **When:** `btn-cancel-transaction-{id}` is pressed
- **Then:** `modal-confirm-cancel-transaction` shows the date, the amount and the description, in its destructive styling, with a confirm and a back control
- **AC:** AC-104
- **Type:** e2e

### TC-135: Declining the confirmation cancels nothing

- **US:** TXN-US-05
- **Given:** `modal-confirm-cancel-transaction` open
- **When:** `modal-confirm-cancel-transaction-cancel` is pressed, then the dialog is reopened and dismissed by pressing Escape
- **Then:** The dialog closes both times, no request is sent, and the row is still recorded
- **AC:** AC-105
- **Type:** e2e

### TC-136: A failing cancellation keeps the confirmation open with the reason

- **US:** TXN-US-05
- **Given:** The cancel endpoint made to fail
- **When:** The confirmation is confirmed
- **Then:** The dialog stays open showing the error message and the confirm control returns to its ready state
- **AC:** AC-106
- **Type:** e2e

### TC-137: A cancelled row shows neither edit nor cancel

- **US:** TXN-US-05
- **Given:** One recorded and one cancelled row
- **When:** Both render
- **Then:** The recorded row has both `btn-edit-transaction-{id}` and `btn-cancel-transaction-{id}`; the cancelled row has neither
- **AC:** AC-107
- **Type:** e2e

### TC-138: A cancelled transaction contributes zero to every figure

- **US:** TXN-US-05
- **Given:** A workspace whose summary is recorded, then a transaction is recorded and cancelled
- **When:** The summary is read again
- **Then:** Every figure — all-time, monthly, daily, per-account, and both series — matches the original exactly
- **AC:** AC-108
- **Type:** integration

### TC-139: Cancelling an unknown transaction is refused as not found

- **US:** TXN-US-05
- **Given:** No transaction with id `999999` in the workspace
- **When:** `DELETE .../transactions/999999`
- **Then:** 404 with `TRANSACTION_NOT_FOUND`
- **AC:** AC-109
- **Type:** integration

### TC-140: A non-member cannot cancel

- **US:** TXN-US-05
- **Given:** A transaction in a workspace the caller is not a member of
- **When:** They attempt to cancel it
- **Then:** 403 with `PERMISSION_DENIED`; the transaction is still recorded
- **AC:** AC-110
- **Type:** integration

### TC-141: A successful cancellation is audited with its reason

- **US:** TXN-US-05
- **Given:** A recorded transaction
- **When:** It is cancelled with a reason
- **Then:** An audit row exists with `event=TXN_CANCEL`, `result: success`, the transaction id, and the reason in its note
- **AC:** AC-111
- **Type:** integration

### TC-142: A refused cancellation is audited as a failure

- **US:** TXN-US-05
- **Given:** An already-cancelled transaction
- **When:** Cancellation is attempted again
- **Then:** An audit row exists with `result: failure` and `error_code: TRANSACTION_ALREADY_CANCELLED`
- **AC:** AC-111
- **Type:** integration

### TC-143: Two simultaneous cancellations reverse the balance once

- **US:** TXN-US-05
- **Given:** An account at `1000.00` with a recorded `250.00` expense, and two concurrent sessions with permission
- **When:** Both issue `DELETE .../transactions/{id}` at the same moment
- **Then:** The documented outcome is asserted — one returns 200, the other 409 `TRANSACTION_ALREADY_CANCELLED`, and the final balance is `1000.00`, not `1250.00`. Nothing currently locks the row between the cancelled-check and the balance adjustment, so this may fail; see [plan.md](plan.md) G9
- **AC:** EC-005
- **Type:** integration

---

## TXN-US-06: Correct a Recorded Transaction

### AC Classification

| AC | Scenario | Classification |
|----|----------|----------------|
| AC-112 | Classification and free text may change | [BOTH] |
| AC-113 | Amount, account, type, date immutable | [API] |
| AC-114 | The form explains why they are fixed | [UI] |
| AC-115 | Clearing differs from leaving alone | [API] |
| AC-116 | An unmentioned field is untouched | [API] |
| AC-117 | A category can be replaced | [API] |
| AC-118 | A foreign-workspace category refused | [API] |
| AC-119 | Description replaced or emptied | [API] |
| AC-120 | Note and tags replaced or emptied | [API] |
| AC-121 | Rate and reported amount unchanged | [API] |
| AC-122 | Balance unchanged | [API] |
| AC-123 | Cancelled cannot be edited | [API] |
| AC-124 | Unknown transaction refused | [API] |
| AC-125 | Foreign-workspace transaction refused | [API] |
| AC-126 | Non-member refused | [API] |
| AC-127 | Creator or OWNER only | [API] |
| AC-128 | Success closes and shows the change | [UI] |
| AC-129 | Refusal keeps the form open | [UI] |
| AC-130 | Audited | [API] |
| EC-004 | Category archived after classification | [API] |
| EC-016 | Category cleared while another member filters by it | [API] |

### Coverage Matrix

| AC | Label | Integration TC(s) | E2E TC(s) |
|----|-------|-------------------|-----------|
| AC-112 | Editable fields | TC-144 | TC-145 |
| AC-113 | Immutable fields | TC-146 | — |
| AC-114 | Disabled with a reason | — | TC-147 |
| AC-115 | Explicit clearing | TC-148 | — |
| AC-116 | Omitted field untouched | TC-149 | — |
| AC-117 | Category replaced | TC-150 | — |
| AC-118 | Foreign category | TC-151 | — |
| AC-119 | Description emptied | TC-152 | — |
| AC-120 | Note and tags emptied | TC-153 | — |
| AC-121 | Rate untouched | TC-154 | — |
| AC-122 | Balance untouched | TC-155 | — |
| AC-123 | Cancelled | TC-156 | — |
| AC-124 | Unknown | TC-157 | — |
| AC-125 | Cross-workspace | TC-158 | — |
| AC-126 | Non-member | TC-159 | — |
| AC-127 | Creator or OWNER | TC-160 | — |
| AC-128 | Close and reflect | — | TC-161 |
| AC-129 | Refusal handling | — | TC-162 |
| AC-130 | Audited | TC-163 | — |
| EC-004 | Archived category retained | TC-164 | — |
| EC-016 | Cleared while filtered | TC-165 | — |

---

### TC-144: Category, description, note and tags can all be changed

- **US:** TXN-US-06
- **Given:** A recorded transaction with a category and a description
- **When:** `PUT .../transactions/{id}` supplies a different category, description, notes and tags
- **Then:** 200 and all four stored values are the new ones
- **AC:** AC-112
- **Type:** integration

### TC-145: An edit made through the dialog is reflected in the row

- **US:** TXN-US-06
- **Given:** A row with a category and description
- **When:** `btn-edit-transaction-{id}` is pressed, `category-transaction` and `description-transaction` changed, and the form saved
- **Then:** The dialog closes and the row shows the new category and description
- **AC:** AC-112
- **Type:** e2e

### TC-146: No request changes the amount, account, type or date

- **US:** TXN-US-06
- **Given:** A recorded transaction
- **When:** `PUT .../transactions/{id}` includes `amount`, `account_id`, `type` and `date` alongside a valid category
- **Then:** 200; the category changes and all four other values are byte-identical to before — the request contract has no such fields
- **AC:** AC-113
- **Type:** integration

### TC-147: The edit form shows the fixed fields as disabled with an explanation

- **US:** TXN-US-06
- **Given:** The edit dialog opened on an existing transaction
- **When:** It renders
- **Then:** `account-transaction`, `type-transaction`, `amount-transaction` and `date-transaction` are populated and disabled, and `hint-immutable-transaction` explains that a correction means cancelling and re-recording
- **AC:** AC-114
- **Type:** e2e

### TC-148: An explicit null clears the category

- **US:** TXN-US-06
- **Given:** A transaction with a category
- **When:** `PUT .../transactions/{id}` with a body containing `"category_id": null`
- **Then:** 200 and the stored category is null
- **AC:** AC-115
- **Type:** integration

### TC-149: A field absent from the body is left alone

- **US:** TXN-US-06
- **Given:** A transaction with a category and a description
- **When:** `PUT .../transactions/{id}` with a body containing only `notes`
- **Then:** 200; the notes change and the category and description are unchanged — the absence of `category_id` is not read as a clear
- **AC:** AC-116
- **Type:** integration

### TC-150: A category can be replaced with another of the workspace

- **US:** TXN-US-06
- **Given:** A transaction classified under one category, and a second category in the same workspace
- **When:** An edit names the second
- **Then:** 200 and the stored category is the second, with `category_name` updated in the response
- **AC:** AC-117
- **Type:** integration

### TC-151: A category from another workspace is refused and nothing changes

- **US:** TXN-US-06
- **Given:** A category belonging to a different workspace
- **When:** An edit names it
- **Then:** 404 with `CATEGORY_NOT_FOUND`, and the transaction's category, description and notes are unchanged
- **AC:** AC-118
- **Type:** integration

### TC-152: A description can be replaced or emptied

- **US:** TXN-US-06
- **Given:** A transaction described `Team lunch`
- **When:** An edit supplies `Client lunch`, then a later edit supplies `""`
- **Then:** The description becomes `Client lunch`, then empty
- **AC:** AC-119
- **Type:** integration

### TC-153: Notes and tags can be replaced or emptied

- **US:** TXN-US-06
- **Given:** A transaction carrying notes and tags
- **When:** An edit supplies different text for both, then a later edit supplies `""` for both
- **Then:** Both take the new text, then become empty. A body sending `null` for either leaves it unchanged, which is the documented meaning of an absent value — see [plan.md](plan.md) G7
- **AC:** AC-120
- **Type:** integration

### TC-154: An edit leaves the stored rate and reported amount untouched

- **US:** TXN-US-06
- **Given:** A cross-currency transaction whose rate and reported amount are noted, and the rate source then changed
- **When:** Its category is edited
- **Then:** 200 and both the stored rate and the reported amount are exactly as before
- **AC:** AC-121
- **Type:** integration

### TC-155: An edit moves no balance

- **US:** TXN-US-06
- **Given:** An account balance noted after a transaction was recorded
- **When:** That transaction's category and description are edited
- **Then:** The balance is unchanged
- **AC:** AC-122
- **Type:** integration

### TC-156: A cancelled transaction cannot be edited

- **US:** TXN-US-06
- **Given:** A cancelled transaction
- **When:** An edit is submitted
- **Then:** 409 with `TRANSACTION_ALREADY_CANCELLED` and nothing changes
- **AC:** AC-123
- **Type:** integration

### TC-157: An unknown transaction cannot be edited

- **US:** TXN-US-06
- **Given:** No transaction with id `999999`
- **When:** `PUT .../transactions/999999`
- **Then:** 404 with `TRANSACTION_NOT_FOUND`
- **AC:** AC-124
- **Type:** integration

### TC-158: A transaction of another workspace cannot be edited through this one

- **US:** TXN-US-06
- **Given:** A transaction in workspace B, the caller a member of workspace A
- **When:** `PUT /workspaces/{A}/transactions/{B's transaction}`
- **Then:** 404 with `TRANSACTION_NOT_FOUND`, and B's transaction is unchanged
- **AC:** AC-125
- **Type:** integration

### TC-159: A non-member cannot edit

- **US:** TXN-US-06
- **Given:** A workspace the caller is not a member of
- **When:** An edit is submitted
- **Then:** 403 with `PERMISSION_DENIED` and a failure audit row
- **AC:** AC-126
- **Type:** integration

### TC-160: A member who is neither creator nor OWNER cannot edit

- **US:** TXN-US-06
- **Given:** A transaction recorded by member A and a second non-owner member B
- **When:** B submits an edit changing its category
- **Then:** The documented outcome is asserted — 403 with `PERMISSION_DENIED` and the category unchanged. The edit path currently checks membership only, so this fails today; see [plan.md](plan.md) G6
- **AC:** AC-127
- **Type:** integration

### TC-161: A successful edit closes the dialog and updates the row in place

- **US:** TXN-US-06
- **Given:** The edit dialog open with a changed category
- **When:** It is saved
- **Then:** `modal-transaction` closes and the row shows the new category without a page reload
- **AC:** AC-128
- **Type:** e2e

### TC-162: A refused edit keeps the dialog open with the reason and the input

- **US:** TXN-US-06
- **Given:** The edit endpoint made to refuse
- **When:** The form is saved
- **Then:** The dialog stays open, an error alert appears, and the edited values are still in the fields
- **AC:** AC-129
- **Type:** e2e

### TC-163: Every edit attempt is audited

- **US:** TXN-US-06
- **Given:** A recorded transaction and a category from another workspace
- **When:** One valid edit and one refused edit are submitted
- **Then:** Audit rows exist with `event=TXN_UPDATE` — one `result: success`, one `result: failure` with `error_code: CATEGORY_NOT_FOUND`
- **AC:** AC-130
- **Type:** integration

### TC-164: A category archived after classification stays on its transactions

- **US:** TXN-US-06
- **Given:** Transactions classified under a category that is then archived
- **When:** They are listed and read
- **Then:** They still carry that category and its name, and it remains filterable, while being unavailable to new classification
- **AC:** EC-004
- **Type:** integration

### TC-165: Clearing a category removes the transaction from that category's filter

- **US:** TXN-US-06
- **Given:** A transaction classified under a category, and a filtered list by that category returning it
- **When:** Its category is cleared and the same filter is requested again
- **Then:** It is absent from the filtered result and present in the unfiltered one, with `total` reduced by one
- **AC:** EC-016
- **Type:** integration

---

## Deliberately unresolved cases

Three cases assert a documented contract that the current code does not satisfy, or that the spec does not yet settle. They are written so the suite states the intent rather than encoding today's behaviour as correct.

| TC | Case | Status |
|----|------|--------|
| TC-115 | Wildcard characters in search text | Undecided — escape them or treat them as text. Currently they act as wildcards |
| TC-143 | Two simultaneous cancellations | Expected to fail — nothing locks the row between the check and the balance adjustment (plan G9) |
| TC-160 | Edit restricted to creator or OWNER | Expected to fail — the edit path checks membership only (plan G6) |

## Coverage summary

| User story | ACs | Integration TCs | E2E TCs |
|---|---|---|---|
| TXN-US-01 Record income | 24 (+5 EC) | 25 | 11 |
| TXN-US-02 Record expense | 20 | 12 | 9 |
| TXN-US-03 Record transfer | 22 (+3 EC) | 26 | 0 |
| TXN-US-04 View history | 23 (+4 EC) | 15 | 17 |
| TXN-US-05 Cancel | 22 (+1 EC) | 20 | 8 |
| TXN-US-06 Correct | 19 (+2 EC) | 18 | 4 |
| **Total** | **130 AC + 15 EC** | **116** | **49** |

Every AC has at least one case. Three edge cases are covered elsewhere rather than here, because the behaviour they test belongs to another feature: **EC-003** (a future-dated transaction once its date arrives) and **EC-007** (the reporting currency changed after recording) in [009-dashboard-reporting](../009-dashboard-reporting/) and [010-multi-currency](../010-multi-currency/); **EC-008** (the rate source returning a valid but wildly wrong rate) in [010-multi-currency](../010-multi-currency/).

TXN-US-03 has no e2e cases at all: there is no transfer form yet ([plan.md](plan.md) T9). Its 26 integration cases fully cover the operation, but nothing exercises it through a browser until that form exists.
