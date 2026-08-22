# Test Cases: Account Management (ACC-US)

> **Feature:** SRS §7 ACC-US
> **Spec:** [spec.md](spec.md)
> **Plan:** [plan.md](plan.md)

Classification: **[API]** verifiable through the HTTP contract alone · **[UI]** only observable in the browser · **[BOTH]** needs both to be meaningful.

Endpoints under test:

| Operation | Endpoint |
|---|---|
| Create | `POST /api/v1/workspaces/{workspaceId}/accounts` |
| List | `GET /api/v1/workspaces/{workspaceId}/accounts` |
| Detail | `GET /api/v1/workspaces/{workspaceId}/accounts/{accountId}` |
| Edit | `PUT /api/v1/workspaces/{workspaceId}/accounts/{accountId}` |
| Archive | `DELETE /api/v1/workspaces/{workspaceId}/accounts/{accountId}/archive` |

---

## ACC-US-01: Create Account

### AC Classification

| AC | Scenario | Classification |
|----|----------|----------------|
| AC-01 | Created with balance equal to opening balance | [BOTH] |
| AC-02 | Immediately usable for recording | [API] |
| AC-03 | Optional detail stored verbatim | [API] |
| AC-04 | Any member may create | [API] |
| AC-05 | Non-member cannot create | [API] |
| AC-06 | Name must be unused | [BOTH] |
| AC-07 | Uniqueness ignores case | [API] |
| AC-08 | Uniqueness scoped to the workspace | [API] |
| AC-09 | An archived name is free again | [API] |
| AC-10 | Name required and bounded | [BOTH] |
| AC-11 | Only a known type | [API] |
| AC-12 | Only a supported currency | [API] |
| AC-13 | No rate is requested | [UI] |
| AC-14 | Rate captured on the account | [API] |
| AC-15 | Matching currency needs no rate | [API] |
| AC-16 | Rate failure refuses creation | [BOTH] |
| AC-17 | Reported opening balance is fixed | [API] |
| AC-18 | Zero opening balance accepted | [API] |
| AC-19 | Precision and magnitude bounded | [API] |
| AC-20 | Negative opening balance refused | [BOTH] |
| AC-21 | Success closes and shows the account | [UI] |
| AC-22 | Every attempt audited | [API] |
| EC-002 | Name reused after archiving | [API] |
| EC-003 | Zero opening balance usable | [API] |
| EC-006 | Two members create the same name at once | [API] |
| EC-010 | Created while the rate source is degraded | [API] |
| EC-011 | Name differing only by surrounding whitespace | [API] |
| EC-012 | Masked number with separators or letters | [API] |

### Coverage Matrix

| AC | Label | Integration TC(s) | E2E TC(s) |
|----|-------|-------------------|-----------|
| AC-01 | Opening balance becomes the balance | TC-01 | TC-02 |
| AC-02 | Usable at once | TC-03 | — |
| AC-03 | Optional detail | TC-04 | — |
| AC-04 | Member may create | TC-05 | — |
| AC-05 | Non-member refused | TC-06 | — |
| AC-06 | Duplicate name | TC-07 | TC-08 |
| AC-07 | Case-insensitive collision | TC-09 | — |
| AC-08 | Workspace scoping | TC-10 | — |
| AC-09 | Archived name reusable | TC-11 | — |
| AC-10 | Name validation | TC-12 | TC-13 |
| AC-11 | Type set | TC-14 | — |
| AC-12 | Currency set | TC-15 | — |
| AC-13 | No rate field | — | TC-16 |
| AC-14 | Rate stored | TC-17 | — |
| AC-15 | Unit rate | TC-18 | — |
| AC-16 | Rate unavailable | TC-19 | TC-20 |
| AC-17 | Fixed reported opening | TC-21 | — |
| AC-18 | Zero accepted | TC-22 | — |
| AC-19 | Bounds | TC-23 | — |
| AC-20 | Negative refused | TC-24 | TC-25 |
| AC-21 | Close and refresh | — | TC-26 |
| AC-22 | Audited | TC-27, TC-28 | — |
| EC-002 | Reuse after archive | TC-29 | — |
| EC-003 | Zero then transact | TC-30 | — |
| EC-006 | Concurrent creation | TC-31 | — |
| EC-010 | Degraded rate source | TC-32 | — |
| EC-011 | Whitespace name | TC-33 | — |
| EC-012 | Masked number shape | TC-34 | — |

---

### TC-01: A created account's balance equals its opening balance

- **US:** ACC-US-01
- **Given:** A workspace reporting in `USD` with no account named `Main`
- **When:** `POST .../accounts` with `type: BANK_ACCOUNT`, `name: Main`, `currency: USD`, `opening_balance: 1500.00`
- **Then:** 201 with the envelope carrying the account; the stored `balance` and `opening_balance` are both `1500.00` and `status` is `active`
- **AC:** AC-01
- **Type:** integration

### TC-02: A member can create an account through the form

- **US:** ACC-US-01
- **Given:** The accounts page is open
- **When:** `btn-add-account` is pressed, `name-account`, `type-account`, `currency-account` and `opening-balance-account` are filled, and `btn-submit-account` is pressed
- **Then:** `modal-account` closes and the new account appears in `table-accounts` with its balance
- **AC:** AC-01
- **Type:** e2e

### TC-03: A new account can immediately receive a transaction

- **US:** ACC-US-01
- **Given:** An account created a moment ago
- **When:** A transaction is recorded against it with no other configuration
- **Then:** 201 and the account's balance moves accordingly
- **AC:** AC-02
- **Type:** integration

### TC-04: Optional detail is stored and returned unchanged

- **US:** ACC-US-01
- **Given:** A workspace
- **When:** An account is created with an institution, a masked number, a colour and an icon, and a second is created with none of them
- **Then:** Both return 201; the first returns each value exactly as sent, the second returns each as null
- **AC:** AC-03
- **Type:** integration

### TC-05: A member who is not an OWNER can create an account

- **US:** ACC-US-01
- **Given:** A workspace member whose role is not OWNER
- **When:** They create an account
- **Then:** 201 — creation is not restricted to ownership, unlike editing and archiving
- **AC:** AC-04
- **Type:** integration

### TC-06: A non-member cannot create, and an unknown workspace is not found

- **US:** ACC-US-01
- **Given:** A workspace the caller is not a member of, and an id matching no workspace
- **When:** `POST .../accounts` against each
- **Then:** 403 with `PERMISSION_DENIED` for the first and 404 with `WORKSPACE_NOT_FOUND` for the second; no account is created
- **AC:** AC-05
- **Type:** integration

### TC-07: A duplicate account name is refused

- **US:** ACC-US-01
- **Given:** An active account named `Main`
- **When:** `POST .../accounts` with `name: Main`
- **Then:** 409 with `error_code: ACCOUNT_NAME_EXISTS`; the account count is unchanged
- **AC:** AC-06
- **Type:** integration

### TC-08: The form reports a name already in use

- **US:** ACC-US-01
- **Given:** An account named `Main` exists
- **When:** The form is submitted with that name
- **Then:** An error alert inside `modal-account` states the name is taken and the dialog stays open with the entered values
- **AC:** AC-06
- **Type:** e2e

### TC-09: A name differing only in case collides

- **US:** ACC-US-01
- **Given:** An active account named `Main`
- **When:** `POST .../accounts` with `name: MAIN`, then with `name: main`
- **Then:** Both return 409 with `ACCOUNT_NAME_EXISTS`
- **AC:** AC-07
- **Type:** integration

### TC-10: The same name is free in another workspace

- **US:** ACC-US-01
- **Given:** An account named `Main` in workspace A, the caller a member of both A and B
- **When:** An account named `Main` is created in workspace B
- **Then:** 201 — uniqueness belongs to a workspace, not to the system
- **AC:** AC-08
- **Type:** integration

### TC-11: An archived account's name can be taken by a new account

- **US:** ACC-US-01
- **Given:** An account named `Main` that has been archived
- **When:** A new account named `Main` is created
- **Then:** 201, and both rows exist — one archived, one active
- **AC:** AC-09
- **Type:** integration

### TC-12: An empty or over-long name is refused

- **US:** ACC-US-01
- **Given:** A workspace
- **When:** `POST .../accounts` with an empty `name`, then with a name of 256 characters
- **Then:** Both return 422 naming the `name` field; no account is created
- **AC:** AC-10
- **Type:** integration

### TC-13: The form refuses an empty name before submitting

- **US:** ACC-US-01
- **Given:** `modal-account` is open
- **When:** `name-account` is left empty and `btn-submit-account` is pressed
- **Then:** An inline error appears beneath the name field and no request is sent
- **AC:** AC-10
- **Type:** e2e

### TC-14: An unknown account type is refused

- **US:** ACC-US-01
- **Given:** A workspace
- **When:** `POST .../accounts` with `type: PIGGY_BANK`
- **Then:** 422 naming the `type` field; the eight defined types are the only ones accepted
- **AC:** AC-11
- **Type:** integration

### TC-15: An unsupported currency is refused

- **US:** ACC-US-01
- **Given:** A workspace
- **When:** `POST .../accounts` with `currency: EUR`
- **Then:** 422 naming the `currency` field. The service's `UNSUPPORTED_CURRENCY` guard sits behind the request contract and is unreachable over HTTP — see [plan.md](plan.md) G5
- **AC:** AC-12
- **Type:** integration

### TC-16: The creation form asks for no exchange rate

- **US:** ACC-US-01
- **Given:** `modal-account` is open with a currency other than the reporting one selected
- **When:** Its fields are enumerated
- **Then:** No rate input exists, and `hint-exchange-rate-account` states that the system will determine the rate
- **AC:** AC-13
- **Type:** e2e

### TC-17: A foreign-currency account stores the rate that applied at creation

- **US:** ACC-US-01
- **Given:** A workspace reporting in `USD`
- **When:** A `VND` account is created with an opening balance
- **Then:** 201; the stored `exchange_rate` is the prevailing `VND`→`USD` rate and `opening_base_balance` equals `opening_balance × exchange_rate`
- **AC:** AC-14
- **Type:** integration

### TC-18: An account in the reporting currency stores a rate of exactly one

- **US:** ACC-US-01
- **Given:** A workspace reporting in `USD`, with the rate provider instrumented
- **When:** A `USD` account is created
- **Then:** The stored rate is exactly `1`, `opening_base_balance` equals `opening_balance`, and the provider was not called
- **AC:** AC-15
- **Type:** integration

### TC-19: A rate that cannot be obtained refuses the creation

- **US:** ACC-US-01
- **Given:** A `USD` workspace with every rate source unavailable — live, cache and configured fallback
- **When:** A `VND` account is submitted
- **Then:** 503 with `EXCHANGE_RATE_UNAVAILABLE`; the account count is unchanged
- **AC:** AC-16
- **Type:** integration

### TC-20: The form reports an unavailable rate and keeps the input

- **US:** ACC-US-01
- **Given:** The endpoint returns `EXCHANGE_RATE_UNAVAILABLE`
- **When:** The form is submitted
- **Then:** An error alert states the rate is unavailable, `modal-account` stays open, and every field still holds what was entered
- **AC:** AC-16
- **Type:** e2e

### TC-21: A rate movement does not restate an account's reported opening balance

- **US:** ACC-US-01
- **Given:** A `VND` account created in a `USD` workspace, its reported opening balance noted
- **When:** The rate source is changed and the account is read again
- **Then:** Both the stored rate and the reported opening balance are exactly as before
- **AC:** AC-17
- **Type:** integration

### TC-22: An opening balance of zero is accepted

- **US:** ACC-US-01
- **Given:** A workspace
- **When:** An account is created with `opening_balance: 0`
- **Then:** 201 with a balance of `0` and `status: active`
- **AC:** AC-18
- **Type:** integration

### TC-23: An over-precise or over-large opening balance is refused

- **US:** ACC-US-01
- **Given:** A workspace
- **When:** `opening_balance: 10.005` is submitted, then a value of sixteen integer digits
- **Then:** Both return 422 naming the `opening_balance` field; no rounding or truncation occurs
- **AC:** AC-19
- **Type:** integration

### TC-24: A negative opening balance is refused

- **US:** ACC-US-01
- **Given:** A workspace
- **When:** `POST .../accounts` with `opening_balance: -500.00`
- **Then:** The documented outcome is asserted — 422 naming the `opening_balance` field, and no account created. The request contract carries no lower bound and the service does not check, so this currently succeeds and stores a negative opening balance; see [plan.md](plan.md) G6
- **AC:** AC-20
- **Type:** integration

### TC-25: The form refuses a negative opening balance

- **US:** ACC-US-01
- **Given:** `modal-account` is open
- **When:** `opening-balance-account` is set to `-500` and the form is submitted
- **Then:** An inline error states the opening balance cannot be negative and no request is sent
- **AC:** AC-20
- **Type:** e2e

### TC-26: A successful creation closes the dialog and updates the total

- **US:** ACC-US-01
- **Given:** A workspace with one account and its total noted from `total-balance-accounts`
- **When:** A second account is created through the form
- **Then:** `modal-account` closes, the new row appears in `table-accounts`, and `total-balance-accounts` has increased by the new account's reported balance, with no page reload
- **AC:** AC-21
- **Type:** e2e

### TC-27: A successful creation writes an audit record

- **US:** ACC-US-01
- **Given:** A workspace
- **When:** An account is created
- **Then:** An audit row exists with `event_name: ACCOUNT_AUDIT`, `action: event=ACCOUNT_CREATE`, `result: success`, the actor's id, the account and workspace ids, and the source address
- **AC:** AC-22
- **Type:** integration

### TC-28: A refused creation writes a failure audit record carrying the reason

- **US:** ACC-US-01
- **Given:** An existing account named `Main`, and separately an unavailable rate source
- **When:** A duplicate name is submitted, then a foreign-currency account during the outage
- **Then:** Two audit rows exist with `result: failure`, carrying `error_code: ACCOUNT_NAME_EXISTS` and `error_code: EXCHANGE_RATE_UNAVAILABLE` respectively
- **AC:** AC-22
- **Type:** integration

### TC-29: A name freed by archiving can be reused, and both rows survive

- **US:** ACC-US-01
- **Given:** An account named `Old Bank` with recorded transactions, then archived
- **When:** A new account named `Old Bank` is created
- **Then:** 201; the archived account keeps its transactions and its balance, and the list shows two rows with that name, one marked archived
- **AC:** EC-002
- **Type:** integration

### TC-30: An account opened at zero can be transacted against immediately

- **US:** ACC-US-01
- **Given:** An account created with an opening balance of zero
- **When:** An income of `100.00` is recorded against it
- **Then:** 201 and the balance becomes `100.00`
- **AC:** EC-003
- **Type:** integration

### TC-31: Two simultaneous creations of the same name produce one account

- **US:** ACC-US-01
- **Given:** Two concurrent sessions, both members of the same workspace, neither name yet taken
- **When:** Both submit `name: Shared` at the same moment
- **Then:** The documented outcome is asserted — one returns 201, the other 409 `ACCOUNT_NAME_EXISTS`, and exactly one active account carries the name. Uniqueness is enforced only by a service-layer read with no database constraint behind it, so both may currently succeed; see [plan.md](plan.md) G14
- **AC:** EC-006
- **Type:** integration

### TC-32: An account created during a provider outage uses a recent rate

- **US:** ACC-US-01
- **Given:** A cached rate from earlier and the live provider unreachable
- **When:** A foreign-currency account is created
- **Then:** 201; the cached rate is stored on the account and the substitution is recorded in the logs
- **AC:** EC-010
- **Type:** integration

### TC-33: A name differing only by surrounding whitespace behaves as documented

- **US:** ACC-US-01
- **Given:** An active account named `Main`
- **When:** `POST .../accounts` with `name: "  Main  "`
- **Then:** The documented outcome is asserted. Comparison is case-insensitive but not whitespace-trimmed, so this currently creates a second account whose name renders identically in the list; whether names are trimmed on input is an open decision — see [plan.md](plan.md) G15
- **AC:** EC-011
- **Type:** integration

### TC-34: A masked number is stored exactly as supplied

- **US:** ACC-US-01
- **Given:** A workspace
- **When:** Accounts are created with `account_number` values of `****1234`, `xxxx-1234` and `1234`
- **Then:** All three return 201 and each value is stored and returned verbatim; no shape is imposed, because masking formats vary by institution
- **AC:** EC-012
- **Type:** integration

---

## ACC-US-02: View Account Details

### AC Classification

| AC | Scenario | Classification |
|----|----------|----------------|
| AC-23 | Every account with its balance | [BOTH] |
| AC-24 | Balance in the account's own currency | [UI] |
| AC-25 | Foreign balance shows an equivalent | [UI] |
| AC-26 | No equivalent when currencies match | [UI] |
| AC-27 | Active before archived, then by name | [BOTH] |
| AC-28 | Fields individually identifiable | [UI] |
| AC-29 | The name leads | [UI] |
| AC-30 | Archived is marked | [UI] |
| AC-31 | A total in the reporting currency | [UI] |
| AC-32 | The total agrees with the dashboard | [UI] |
| AC-33 | Figures comparable at a glance | [UI] |
| AC-34 | Narrowing to active or archived | [API] |
| AC-35 | Pagination with a total | [API] |
| AC-36 | Out-of-range page does not fail | [API] |
| AC-37 | Single account retrievable | [API] |
| AC-38 | Foreign-workspace account not retrievable | [API] |
| AC-39 | Archived account still readable | [API] |
| AC-40 | An account's own movements | [API] |
| AC-41 | Empty list explains itself | [UI] |
| AC-42 | Non-member cannot read | [API] |
| EC-007 | More accounts than one page | [API] |
| EC-013 | Every account archived | [UI] |
| EC-014 | Currency later differs from the reporting one | [API] |

### Coverage Matrix

| AC | Label | Integration TC(s) | E2E TC(s) |
|----|-------|-------------------|-----------|
| AC-23 | List with balances | TC-35 | TC-36 |
| AC-24 | Own currency | — | TC-37 |
| AC-25 | Equivalent shown | — | TC-38 |
| AC-26 | Equivalent omitted | — | TC-39 |
| AC-27 | Ordering | TC-40 | TC-41 |
| AC-28 | Distinct fields | — | TC-42 |
| AC-29 | Name emphasis | — | TC-43 |
| AC-30 | Archived marker | — | TC-44 |
| AC-31 | Total | — | TC-45 |
| AC-32 | Agreement with the dashboard | — | TC-46 |
| AC-33 | Aligned digits | — | TC-47 |
| AC-34 | Status filter | TC-48 | — |
| AC-35 | Pagination | TC-49 | — |
| AC-36 | Bounds | TC-50 | — |
| AC-37 | Detail | TC-51 | — |
| AC-38 | Cross-workspace | TC-52 | — |
| AC-39 | Archived readable | TC-53 | — |
| AC-40 | Per-account movements | TC-54 | — |
| AC-41 | Empty state | — | TC-55 |
| AC-42 | Non-member | TC-56 | — |
| EC-007 | Beyond one page | TC-57 | — |
| EC-013 | All archived | — | TC-58 |
| EC-014 | Currency drifts from reporting | TC-59 | — |

---

### TC-35: The list returns every account of the workspace with its balance

- **US:** ACC-US-02
- **Given:** A workspace with three accounts of differing balances
- **When:** `GET .../accounts`
- **Then:** 200 with all three, each carrying `balance`, `opening_balance`, `currency`, `exchange_rate` and `status`
- **AC:** AC-23
- **Type:** integration

### TC-36: The accounts page lists every account

- **US:** ACC-US-02
- **Given:** A workspace with three accounts
- **When:** The page renders
- **Then:** `table-accounts` contains three rows and the card heading shows the count
- **AC:** AC-23
- **Type:** e2e

### TC-37: Each balance is formatted in its own account's currency

- **US:** ACC-US-02
- **Given:** A `VND` account and a `USD` account in a `USD` workspace
- **When:** The list renders
- **Then:** The first row's principal figure is formatted as `VND` and the second's as `USD`
- **AC:** AC-24
- **Type:** e2e

### TC-38: A foreign balance carries a labelled equivalent

- **US:** ACC-US-02
- **Given:** A `VND` account in a `USD` workspace
- **When:** Its row renders
- **Then:** A secondary line shows the `USD` equivalent prefixed with `≈`, subordinate to the account's own figure
- **AC:** AC-25
- **Type:** e2e

### TC-39: An account in the reporting currency shows no equivalent

- **US:** ACC-US-02
- **Given:** A `USD` account in a `USD` workspace
- **When:** Its row renders
- **Then:** No `≈` line is present
- **AC:** AC-26
- **Type:** e2e

### TC-40: The list orders active accounts before archived ones, then by name

- **US:** ACC-US-02
- **Given:** Accounts `Zeta` (active), `Alpha` (active) and `Beta` (archived)
- **When:** `GET .../accounts`
- **Then:** The order is `Alpha`, `Zeta`, `Beta`
- **AC:** AC-27
- **Type:** integration

### TC-41: The page opens on what is in use

- **US:** ACC-US-02
- **Given:** The same three accounts
- **When:** `table-accounts` renders
- **Then:** The archived row is last
- **AC:** AC-27
- **Type:** e2e

### TC-42: Name, type, currency, institution and masked number are each distinguishable

- **US:** ACC-US-02
- **Given:** An account carrying all five
- **When:** Its row renders
- **Then:** The type and currency are badges, the institution and masked number are icon-labelled meta items with accessible labels, and none of them shares the name's styling
- **AC:** AC-28
- **Type:** e2e

### TC-43: The name is the only emphasised field

- **US:** ACC-US-02
- **Given:** The same row
- **When:** It renders
- **Then:** The name is the sole element in strong type
- **AC:** AC-29
- **Type:** e2e

### TC-44: An archived account is marked and subdued

- **US:** ACC-US-02
- **Given:** An archived account
- **When:** Its row renders
- **Then:** It carries an archived badge and the row is dimmed
- **AC:** AC-30
- **Type:** e2e

### TC-45: The list shows a total in the reporting currency

- **US:** ACC-US-02
- **Given:** A `USD` workspace with a `USD` and a `VND` account
- **When:** The page renders
- **Then:** `total-balance-accounts` is formatted in `USD` and equals the sum of each account's balance converted at its own stored rate
- **AC:** AC-31
- **Type:** e2e

### TC-46: The accounts total equals the dashboard's total balance

- **US:** ACC-US-02
- **Given:** A workspace with two active accounts and one archived account carrying a non-zero balance
- **When:** `total-balance-accounts` and the dashboard's total balance are both read
- **Then:** The documented outcome is asserted — the two agree within one minor unit. The accounts total excludes archived accounts while the dashboard includes them, so this currently fails whenever an archived account holds a balance; see [plan.md](plan.md) G7
- **AC:** AC-32
- **Type:** e2e

### TC-47: Balances align across rows

- **US:** ACC-US-02
- **Given:** Balances of differing digit counts
- **When:** The list renders
- **Then:** Every figure uses tabular numerals so the columns line up
- **AC:** AC-33
- **Type:** e2e

### TC-48: The list can be narrowed to active or archived

- **US:** ACC-US-02
- **Given:** Two active and one archived account
- **When:** `GET .../accounts?status=active`, then `?status=archived`
- **Then:** The first returns the two active with `total: 2`, the second the one archived with `total: 1`
- **AC:** AC-34
- **Type:** integration

### TC-49: Pagination returns a page, a total and whether more remain

- **US:** ACC-US-02
- **Given:** 30 accounts
- **When:** `GET .../accounts?page=1&page_size=10`, then `page=3`
- **Then:** Each returns 10 accounts with `total: 30`; `has_more` is true on page 1 and false on page 3; no account appears on two pages
- **AC:** AC-35
- **Type:** integration

### TC-50: An out-of-range page or page size is brought within bounds

- **US:** ACC-US-02
- **Given:** A workspace with accounts
- **When:** `page_size=0`, `page_size=5000` and `page=0` are each requested
- **Then:** The documented outcome is asserted — each responds 200 with the value brought within bounds and the size actually used reported back. Nothing clamps these on this endpoint, so `page_size=0` returns an empty list and `page=0` produces a negative offset and a server error; see [plan.md](plan.md) G8
- **AC:** AC-36
- **Type:** integration

### TC-51: A single account can be read on its own

- **US:** ACC-US-02
- **Given:** An account with an institution and a masked number
- **When:** `GET .../accounts/{id}`
- **Then:** 200 carrying its type, name, currency, balance, opening balance, stored rate, reported opening balance and status
- **AC:** AC-37
- **Type:** integration

### TC-52: An account of another workspace is not readable through this one

- **US:** ACC-US-02
- **Given:** An account in workspace B, the caller a member of workspace A
- **When:** `GET /workspaces/{A}/accounts/{B's account}`
- **Then:** 404 with `ACCOUNT_NOT_FOUND`, and a failure audit row is written
- **AC:** AC-38
- **Type:** integration

### TC-53: An archived account is still readable

- **US:** ACC-US-02
- **Given:** An archived account
- **When:** `GET .../accounts/{id}`
- **Then:** 200 with `status: archived` and its balance intact
- **AC:** AC-39
- **Type:** integration

### TC-54: An account's own movements can be reviewed

- **US:** ACC-US-02
- **Given:** An account with five recorded transactions
- **When:** That account's movements are requested
- **Then:** The documented outcome is asserted — the transactions of that account are returned with their dates and amounts. No per-account view exists; the equivalent today is the transaction history filtered by `account_id`, which this case exercises as the interim contract; see [plan.md](plan.md) G9
- **AC:** AC-40
- **Type:** integration

### TC-55: An empty workspace offers the first account

- **US:** ACC-US-02
- **Given:** A workspace with no accounts
- **When:** The page renders
- **Then:** `empty-accounts` is shown with its hint and `btn-create-first-account` opens `modal-account`
- **AC:** AC-41
- **Type:** e2e

### TC-56: A non-member cannot read the list or an account

- **US:** ACC-US-02
- **Given:** A workspace the caller is not a member of
- **When:** The list and the detail endpoints are each requested
- **Then:** Both return 403 with `PERMISSION_DENIED`
- **AC:** AC-42
- **Type:** integration

### TC-57: A workspace with more accounts than one page returns them all across pages

- **US:** ACC-US-02
- **Given:** 30 accounts and the default page size of 25
- **When:** The list is requested without paging parameters, then page 2
- **Then:** The first response carries 25 accounts with `total: 30` and `has_more: true`; page 2 carries the remaining 5. The accounts page requests no page size and therefore shows only the first 25, with a total covering only those — see [plan.md](plan.md) G16
- **AC:** EC-007
- **Type:** integration

### TC-58: A workspace whose accounts are all archived still lists them

- **US:** ACC-US-02
- **Given:** A workspace with two accounts, both archived
- **When:** The page renders
- **Then:** Both rows appear marked as archived, and the transaction screen states that an account is needed
- **AC:** EC-013
- **Type:** e2e

### TC-59: An account whose currency was the reporting one keeps its stored rate until restated

- **US:** ACC-US-02
- **Given:** A `USD` account in a `USD` workspace, its stored rate being exactly `1`
- **When:** The workspace reporting currency is changed to `VND` and the account is read
- **Then:** Its stored rate is no longer `1` but the `USD`→`VND` rate, because the restating operation re-snapshotted it; its balance and opening balance are unchanged
- **AC:** EC-014
- **Type:** integration

---

## ACC-US-03: Edit Account

### AC Classification

| AC | Scenario | Classification |
|----|----------|----------------|
| AC-43 | Name, institution, masked number change | [BOTH] |
| AC-44 | Type, currency, opening balance immutable | [API] |
| AC-45 | Fixed fields shown with real values | [UI] |
| AC-46 | The reason is stated | [UI] |
| AC-47 | Currency never editable | [API] |
| AC-48 | OWNER only | [API] |
| AC-49 | Non-owner not offered the control | [UI] |
| AC-50 | Non-member refused | [API] |
| AC-51 | Rename collision refused | [BOTH] |
| AC-52 | Unchanged name accepted | [API] |
| AC-53 | Case-only rename accepted | [API] |
| AC-54 | Archived name available | [API] |
| AC-55 | Archived account not editable | [API] |
| AC-56 | Unknown account | [API] |
| AC-57 | Foreign-workspace account | [API] |
| AC-58 | Omitted field untouched | [API] |
| AC-59 | Institution and number can be emptied | [API] |
| AC-60 | Balance untouched | [API] |
| AC-61 | Stored rate untouched | [API] |
| AC-62 | Success closes and reflects | [UI] |
| AC-63 | Refusal keeps the form | [UI] |
| AC-64 | Audited with old and new name | [API] |
| EC-009 | Archived while the edit form is open | [API] |

### Coverage Matrix

| AC | Label | Integration TC(s) | E2E TC(s) |
|----|-------|-------------------|-----------|
| AC-43 | Editable fields | TC-60 | TC-61 |
| AC-44 | Immutable fields | TC-62 | — |
| AC-45 | Real values shown | — | TC-63 |
| AC-46 | Explanation | — | TC-64 |
| AC-47 | No currency path | TC-65 | — |
| AC-48 | OWNER only | TC-66 | — |
| AC-49 | Control hidden | — | TC-67 |
| AC-50 | Non-member | TC-68 | — |
| AC-51 | Collision | TC-69 | TC-70 |
| AC-52 | Same name | TC-71 | — |
| AC-53 | Case change | TC-72 | — |
| AC-54 | Archived name | TC-73 | — |
| AC-55 | Archived account | TC-74 | — |
| AC-56 | Unknown | TC-75 | — |
| AC-57 | Cross-workspace | TC-76 | — |
| AC-58 | Omitted field | TC-77 | — |
| AC-59 | Emptying | TC-78 | — |
| AC-60 | Balance | TC-79 | — |
| AC-61 | Rate | TC-80 | — |
| AC-62 | Close and reflect | — | TC-81 |
| AC-63 | Refusal handling | — | TC-82 |
| AC-64 | Audit | TC-83, TC-84 | — |
| EC-009 | Archived mid-edit | TC-85 | — |

---

### TC-60: An OWNER can change the name, institution and masked number

- **US:** ACC-US-03
- **Given:** An account named `Main` at `Old Bank`
- **When:** `PUT .../accounts/{id}` supplies a new name, institution and masked number
- **Then:** 200 and all three stored values are the new ones
- **AC:** AC-43
- **Type:** integration

### TC-61: An edit made through the dialog is reflected in the row

- **US:** ACC-US-03
- **Given:** An account row
- **When:** `btn-edit-account-{id}` is pressed, `name-account` and `institution-account` are changed and `btn-submit-account` is pressed
- **Then:** `modal-account` closes and the row shows the new name and institution
- **AC:** AC-43
- **Type:** e2e

### TC-62: No request changes the type, currency or opening balance

- **US:** ACC-US-03
- **Given:** A `VND` `SAVINGS` account with an opening balance of `1000000`
- **When:** `PUT .../accounts/{id}` includes `type: CASH`, `currency: USD` and `opening_balance: 1` alongside a valid name
- **Then:** 200; the name changes and the type, currency, opening balance, stored rate and reported opening balance are all byte-identical to before — the request contract carries no such fields
- **AC:** AC-44
- **Type:** integration

### TC-63: The edit form shows the immutable fields with their actual values

- **US:** ACC-US-03
- **Given:** A `VND` `SAVINGS` account with an opening balance of `1000000`
- **When:** Its edit dialog opens
- **Then:** The documented outcome is asserted — `type-account`, `currency-account` and `opening-balance-account` are disabled and hold `SAVINGS`, `VND` and `1000000`. The opening balance is reset to `0` when the dialog opens for an edit, so the field currently shows a value the account does not have; see [plan.md](plan.md) G10
- **AC:** AC-45
- **Type:** e2e

### TC-64: The form states which fields are fixed and where the currency is changed

- **US:** ACC-US-03
- **Given:** The edit dialog is open
- **When:** It renders
- **Then:** `hint-immutable-account` names the fixed fields and directs the member to the workspace reporting currency
- **AC:** AC-46
- **Type:** e2e

### TC-65: No request path changes an account's currency

- **US:** ACC-US-03
- **Given:** A `VND` account
- **When:** The account request contracts are inspected and an edit is submitted carrying `currency`
- **Then:** No contract accepts a currency after creation and the stored currency is unchanged; changing the reporting currency is the separate operation that re-snapshots rates instead
- **AC:** AC-47
- **Type:** integration

### TC-66: A member who is not an OWNER cannot edit

- **US:** ACC-US-03
- **Given:** A non-owner member of the workspace
- **When:** They submit an edit
- **Then:** 403 with `PERMISSION_DENIED`, nothing changes, and a failure audit row is written
- **AC:** AC-48
- **Type:** integration

### TC-67: A non-owner is offered no edit control

- **US:** ACC-US-03
- **Given:** A session for a member whose role is not OWNER
- **When:** The accounts page renders
- **Then:** The documented outcome is asserted — no `btn-edit-account-{id}` exists on any row. The page does not consult the member's role, so the control is currently shown to everyone and pressing it ends in a refusal; see [plan.md](plan.md) G11
- **AC:** AC-49
- **Type:** e2e

### TC-68: A non-member cannot edit

- **US:** ACC-US-03
- **Given:** A workspace the caller is not a member of
- **When:** An edit is submitted
- **Then:** 403 with `PERMISSION_DENIED`
- **AC:** AC-50
- **Type:** integration

### TC-69: Renaming to a name another active account holds is refused

- **US:** ACC-US-03
- **Given:** Active accounts `Main` and `Savings`
- **When:** `Savings` is renamed to `Main`, then to `MAIN`
- **Then:** Both return 409 with `ACCOUNT_NAME_EXISTS` and nothing changes
- **AC:** AC-51
- **Type:** integration

### TC-70: The form reports a rename collision

- **US:** ACC-US-03
- **Given:** Two accounts, one named `Main`
- **When:** The other is renamed to `Main` and saved
- **Then:** An error alert states the name is taken and `modal-account` stays open
- **AC:** AC-51
- **Type:** e2e

### TC-71: Saving the account's existing name is accepted

- **US:** ACC-US-03
- **Given:** An account named `Main`
- **When:** An edit resubmits `name: Main` with a new institution
- **Then:** 200 — the account does not collide with itself — and the institution changes
- **AC:** AC-52
- **Type:** integration

### TC-72: Recapitalising an account's own name is accepted

- **US:** ACC-US-03
- **Given:** An account named `main bank`
- **When:** It is renamed to `Main Bank`
- **Then:** 200 and the stored name is `Main Bank`
- **AC:** AC-53
- **Type:** integration

### TC-73: An archived account's name can be taken by rename

- **US:** ACC-US-03
- **Given:** An archived account named `Old` and an active account named `Current`
- **When:** `Current` is renamed to `Old`
- **Then:** 200, consistently with creating a new account under an archived name
- **AC:** AC-54
- **Type:** integration

### TC-74: An archived account cannot be edited

- **US:** ACC-US-03
- **Given:** An archived account
- **When:** An edit is submitted
- **Then:** 409 with `ACCOUNT_ARCHIVED`, nothing changes, and a failure audit row is written
- **AC:** AC-55
- **Type:** integration

### TC-75: An unknown account cannot be edited

- **US:** ACC-US-03
- **Given:** No account with id `999999` in the workspace
- **When:** `PUT .../accounts/999999`
- **Then:** 404 with `ACCOUNT_NOT_FOUND`
- **AC:** AC-56
- **Type:** integration

### TC-76: An account of another workspace cannot be edited through this one

- **US:** ACC-US-03
- **Given:** An account in workspace B, the caller an OWNER of workspace A
- **When:** `PUT /workspaces/{A}/accounts/{B's account}`
- **Then:** 404 with `ACCOUNT_NOT_FOUND` and B's account is unchanged
- **AC:** AC-57
- **Type:** integration

### TC-77: A field absent from the body keeps its value

- **US:** ACC-US-03
- **Given:** An account with a name, an institution and a masked number
- **When:** `PUT .../accounts/{id}` with a body containing only `institution`
- **Then:** 200; the institution changes and the name and masked number are unchanged
- **AC:** AC-58
- **Type:** integration

### TC-78: An institution or masked number can be emptied

- **US:** ACC-US-03
- **Given:** An account carrying both
- **When:** An edit supplies empty text for each
- **Then:** The documented outcome is asserted — both become empty. Empty and absent are indistinguishable in the current repository, so both are treated as "leave alone" and the values persist; see [plan.md](plan.md) G12
- **AC:** AC-59
- **Type:** integration

### TC-79: An edit moves no money

- **US:** ACC-US-03
- **Given:** An account with a balance changed by recorded transactions
- **When:** Its name and institution are edited
- **Then:** The balance and the opening balance are unchanged
- **AC:** AC-60
- **Type:** integration

### TC-80: An edit leaves the stored rate untouched

- **US:** ACC-US-03
- **Given:** A `VND` account in a `USD` workspace, its stored rate and reported opening balance noted, and the rate source then changed
- **When:** Its name is edited
- **Then:** Both figures are exactly as before
- **AC:** AC-61
- **Type:** integration

### TC-81: A successful edit closes the dialog and updates the row in place

- **US:** ACC-US-03
- **Given:** The edit dialog open with a changed name
- **When:** It is saved
- **Then:** `modal-account` closes and the row shows the new name without a page reload
- **AC:** AC-62
- **Type:** e2e

### TC-82: A refused edit keeps the dialog open with the reason and the input

- **US:** ACC-US-03
- **Given:** The edit endpoint made to refuse
- **When:** The form is saved
- **Then:** The dialog stays open, an error alert appears, and the edited values are still in the fields
- **AC:** AC-63
- **Type:** e2e

### TC-83: A rename is audited with its old and new values

- **US:** ACC-US-03
- **Given:** An account named `Main`
- **When:** It is renamed to `Primary`
- **Then:** An audit row exists with `event=ACCOUNT_UPDATE`, `result: success`, and details carrying `old_name=Main` and `new_name=Primary`
- **AC:** AC-64
- **Type:** integration

### TC-84: An edit that changes no name is audited without name details

- **US:** ACC-US-03
- **Given:** An account
- **When:** Only its institution is edited
- **Then:** An audit row exists with `result: success` and no old/new name pair, because nothing renamed
- **AC:** AC-64
- **Type:** integration

### TC-85: An account archived while its edit form was open refuses the save

- **US:** ACC-US-03
- **Given:** An OWNER whose edit payload was prepared while the account was active, the account then archived
- **When:** The edit is submitted
- **Then:** 409 with `ACCOUNT_ARCHIVED` and nothing changes, so the check is made at submission rather than at form load
- **AC:** EC-009
- **Type:** integration

---

## ACC-US-04: Archive Account

### AC Classification

| AC | Scenario | Classification |
|----|----------|----------------|
| AC-65 | Withdrawn from new recording | [BOTH] |
| AC-66 | Stays visible | [UI] |
| AC-67 | History untouched | [API] |
| AC-68 | Balance untouched | [API] |
| AC-69 | Recording refused | [API] |
| AC-70 | Transfer refused | [API] |
| AC-71 | Confirmation names the account | [UI] |
| AC-72 | Confirmation can be abandoned | [UI] |
| AC-73 | Refusal does not look successful | [UI] |
| AC-74 | OWNER only | [API] |
| AC-75 | Non-owner not offered the control | [UI] |
| AC-76 | Non-member refused | [API] |
| AC-77 | Archiving twice refused | [BOTH] |
| AC-78 | Unknown account | [API] |
| AC-79 | Foreign-workspace account | [API] |
| AC-80 | Cannot be undone | [BOTH] |
| AC-81 | History still counts | [API] |
| AC-82 | The last account may be archived | [UI] |
| AC-83 | The moment is recorded | [API] |
| AC-84 | Every attempt audited | [API] |
| EC-001 | Archived while a transaction form is open | [API] |
| EC-004 | Reporting currency changed afterwards | [API] |
| EC-005 | The last active account archived | [UI] |
| EC-008 | An account with a negative balance archived | [API] |

### Coverage Matrix

| AC | Label | Integration TC(s) | E2E TC(s) |
|----|-------|-------------------|-----------|
| AC-65 | Not offered for recording | TC-86 | TC-87 |
| AC-66 | Still listed | — | TC-88 |
| AC-67 | History intact | TC-89 | — |
| AC-68 | Balance intact | TC-90 | — |
| AC-69 | Recording refused | TC-91 | — |
| AC-70 | Transfer refused | TC-92 | — |
| AC-71 | Confirmation content | — | TC-93 |
| AC-72 | Abandonment | — | TC-94 |
| AC-73 | Visible refusal | — | TC-95 |
| AC-74 | OWNER only | TC-96 | — |
| AC-75 | Control hidden | — | TC-97 |
| AC-76 | Non-member | TC-98 | — |
| AC-77 | Twice | TC-99 | TC-100 |
| AC-78 | Unknown | TC-101 | — |
| AC-79 | Cross-workspace | TC-102 | — |
| AC-80 | No restore | TC-103 | TC-104 |
| AC-81 | Counted in figures | TC-105 | — |
| AC-82 | Last account | — | TC-106 |
| AC-83 | Timestamp | TC-107 | — |
| AC-84 | Audit | TC-108, TC-109 | — |
| EC-001 | Archived mid-form | TC-110 | — |
| EC-004 | Currency changed after archiving | TC-111 | — |
| EC-005 | Nowhere left to record | — | TC-112 |
| EC-008 | Negative balance archived | TC-113 | — |

---

### TC-86: An archived account is not among those offered for a new transaction

- **US:** ACC-US-04
- **Given:** Two accounts, one then archived
- **When:** The accounts available for recording are read
- **Then:** Only the active account is offered
- **AC:** AC-65
- **Type:** integration

### TC-87: The transaction form does not offer an archived account

- **US:** ACC-US-04
- **Given:** A workspace with one active and one archived account
- **When:** `modal-transaction` opens and `account-transaction` is enumerated
- **Then:** Only the active account appears as an option
- **AC:** AC-65
- **Type:** e2e

### TC-88: An archived account remains in the accounts list

- **US:** ACC-US-04
- **Given:** An archived account
- **When:** The accounts page renders
- **Then:** Its row is present, marked archived
- **AC:** AC-66
- **Type:** e2e

### TC-89: Archiving leaves the account's transactions exactly as they were

- **US:** ACC-US-04
- **Given:** An account with five recorded transactions, their ids, amounts and statuses noted
- **When:** The account is archived
- **Then:** All five are unchanged in every field
- **AC:** AC-67
- **Type:** integration

### TC-90: Archiving does not change the balance

- **US:** ACC-US-04
- **Given:** An account with a balance of `1500.00`
- **When:** It is archived
- **Then:** Its balance is still `1500.00` — archiving is not a withdrawal
- **AC:** AC-68
- **Type:** integration

### TC-91: Recording against an archived account is refused as archived

- **US:** ACC-US-04
- **Given:** An archived account
- **When:** A transaction is submitted against it
- **Then:** 409 with `ACCOUNT_ARCHIVED` — not `ACCOUNT_NOT_FOUND` — and nothing is stored
- **AC:** AC-69
- **Type:** integration

### TC-92: A transfer touching an archived account is refused entirely

- **US:** ACC-US-04
- **Given:** One active and one archived account
- **When:** A transfer is submitted with the archived one as source, then as destination
- **Then:** Both return 409 with `ACCOUNT_ARCHIVED` and neither side of either transfer is created
- **AC:** AC-70
- **Type:** integration

### TC-93: The confirmation names the account and its balance

- **US:** ACC-US-04
- **Given:** An account named `Old Bank` with a balance of `250.00`
- **When:** `btn-archive-account-{id}` is pressed
- **Then:** `modal-confirm-archive-account` shows the name and the balance in its warning styling, with a confirm and a back control
- **AC:** AC-71
- **Type:** e2e

### TC-94: Declining the confirmation archives nothing

- **US:** ACC-US-04
- **Given:** `modal-confirm-archive-account` open
- **When:** `modal-confirm-archive-account-cancel` is pressed, then the dialog is reopened and dismissed with Escape
- **Then:** The dialog closes both times, no request is sent, and the account is still active
- **AC:** AC-72
- **Type:** e2e

### TC-95: A refused archive keeps the confirmation open and the account active

- **US:** ACC-US-04
- **Given:** The archive endpoint made to refuse
- **When:** The confirmation is confirmed
- **Then:** The dialog stays open showing the reason, the confirm control returns to its ready state, and the row is still active after a refresh
- **AC:** AC-73
- **Type:** e2e

### TC-96: A member who is not an OWNER cannot archive

- **US:** ACC-US-04
- **Given:** A non-owner member
- **When:** They submit an archive
- **Then:** 403 with `PERMISSION_DENIED`, the account stays active, and a failure audit row is written
- **AC:** AC-74
- **Type:** integration

### TC-97: A non-owner is offered no archive control

- **US:** ACC-US-04
- **Given:** A session for a member whose role is not OWNER
- **When:** The accounts page renders
- **Then:** The documented outcome is asserted — no `btn-archive-account-{id}` exists on any row. The page does not consult the member's role, so it is currently shown to everyone; see [plan.md](plan.md) G11
- **AC:** AC-75
- **Type:** e2e

### TC-98: A non-member cannot archive

- **US:** ACC-US-04
- **Given:** A workspace the caller is not a member of
- **When:** An archive is submitted
- **Then:** 403 with `PERMISSION_DENIED`
- **AC:** AC-76
- **Type:** integration

### TC-99: Archiving an already-archived account is refused

- **US:** ACC-US-04
- **Given:** An archived account
- **When:** `DELETE .../accounts/{id}/archive` is called again
- **Then:** 409 with `ACCOUNT_ARCHIVED`, and the recorded archive moment is unchanged
- **AC:** AC-77
- **Type:** integration

### TC-100: An archived row offers no second archive

- **US:** ACC-US-04
- **Given:** An archived row in the list
- **When:** It renders
- **Then:** No `btn-archive-account-{id}` exists for it
- **AC:** AC-77
- **Type:** e2e

### TC-101: Archiving an unknown account is refused as not found

- **US:** ACC-US-04
- **Given:** No account with id `999999` in the workspace
- **When:** `DELETE .../accounts/999999/archive`
- **Then:** 404 with `ACCOUNT_NOT_FOUND`
- **AC:** AC-78
- **Type:** integration

### TC-102: An account of another workspace cannot be archived through this one

- **US:** ACC-US-04
- **Given:** An account in workspace B, the caller an OWNER of workspace A
- **When:** `DELETE /workspaces/{A}/accounts/{B's account}/archive`
- **Then:** 404 with `ACCOUNT_NOT_FOUND` and B's account is still active
- **AC:** AC-79
- **Type:** integration

### TC-103: No request restores an archived account

- **US:** ACC-US-04
- **Given:** An archived account
- **When:** The API surface is inspected for a restore or unarchive operation, and an edit attempts to clear the archive marker
- **Then:** No such operation exists and no request returns the account to active
- **AC:** AC-80
- **Type:** integration

### TC-104: The list offers no way to restore

- **US:** ACC-US-04
- **Given:** An archived row
- **When:** Its controls are enumerated
- **Then:** No restore control is present
- **AC:** AC-80
- **Type:** e2e

### TC-105: An archived account still contributes to the workspace's figures

- **US:** ACC-US-04
- **Given:** A workspace whose dashboard summary is recorded, containing an account with an opening balance and transactions
- **When:** That account is archived and the summary is read again
- **Then:** The total balance, the flow figures and the per-account section are unchanged, because the money was real
- **AC:** AC-81
- **Type:** integration

### TC-106: Archiving the last account leaves the transaction screen explaining itself

- **US:** ACC-US-04
- **Given:** A workspace whose only account is archived
- **When:** The transactions page renders
- **Then:** `empty-transactions-no-account` is shown, `btn-goto-accounts` offers the way back, and `btn-add-transaction` is disabled
- **AC:** AC-82
- **Type:** e2e

### TC-107: The moment of archiving is recorded and is what marks the account

- **US:** ACC-US-04
- **Given:** An active account
- **When:** It is archived
- **Then:** The stored row carries an archive timestamp at or after the request, and the response reports `status: archived` derived from it
- **AC:** AC-83
- **Type:** integration

### TC-108: A successful archive writes an audit record

- **US:** ACC-US-04
- **Given:** An active account
- **When:** It is archived
- **Then:** An audit row exists with `event=ACCOUNT_ARCHIVE`, `result: success`, the actor, the account and workspace ids, and the source address
- **AC:** AC-84
- **Type:** integration

### TC-109: A refused archive writes a failure audit record

- **US:** ACC-US-04
- **Given:** An already-archived account, and separately an unknown account id
- **When:** An archive is attempted against each
- **Then:** The documented outcome is asserted — two audit rows with `result: failure`, carrying `error_code: ACCOUNT_ARCHIVED` and `error_code: ACCOUNT_NOT_FOUND`. The repeated-archive branch raises without writing an audit row, so the first assertion currently fails; see [plan.md](plan.md) G13
- **AC:** AC-84
- **Type:** integration

### TC-110: An account archived while a transaction form was open refuses the submission

- **US:** ACC-US-04
- **Given:** A transaction payload prepared while the account was active, the account then archived
- **When:** The transaction is submitted
- **Then:** 409 with `ACCOUNT_ARCHIVED` and nothing is stored
- **AC:** EC-001
- **Type:** integration

### TC-111: The reporting currency change restates an archived account too

- **US:** ACC-US-04
- **Given:** An archived `VND` account in a `USD` workspace
- **When:** The reporting currency is changed to `VND`
- **Then:** The archived account's stored rate becomes exactly `1` along with the active ones, so the totals that include it stay consistent
- **AC:** EC-004
- **Type:** integration

### TC-112: A workspace with nowhere left to record says so

- **US:** ACC-US-04
- **Given:** A workspace whose only account has just been archived from the accounts page
- **When:** The member navigates to transactions
- **Then:** The no-account empty state is shown rather than a form that cannot be submitted
- **AC:** EC-005
- **Type:** e2e

### TC-113: An account carrying a negative balance can be archived

- **US:** ACC-US-04
- **Given:** A credit-card account with a balance of `-450.00`
- **When:** It is archived
- **Then:** 200; the balance is still `-450.00` and it still contributes to the workspace total
- **AC:** EC-008
- **Type:** integration

---

## Deliberately unresolved cases

Ten cases assert a documented contract the current code does not satisfy, or one the spec has not yet settled. They are written so the suite states the intent rather than encoding today's behaviour as correct.

| TC | Case | Status |
|----|------|--------|
| TC-24 | Negative opening balance refused | Expected to fail — no lower bound in the contract or the service; only the form enforces it (plan G6) |
| TC-31 | Concurrent creation of the same name | Expected to fail — uniqueness is a service-layer read with no database constraint (plan G14) |
| TC-33 | Name differing only by surrounding whitespace | Undecided — trim on input, or compare untrimmed (plan G15) |
| TC-46 | Accounts total equals the dashboard total | Expected to fail — the list excludes archived accounts, the dashboard includes them (plan G7) |
| TC-50 | Out-of-range page and page size | Expected to fail — nothing clamps them; `page=0` produces a server error (plan G8) |
| TC-54 | An account's own movements | Not implemented — exercises the filtered history as the interim contract (plan G9) |
| TC-57 | More accounts than one page | Passes at the API; the page shows only the first 25 and totals only those (plan G16) |
| TC-63 | Immutable fields show their real values | Expected to fail — the opening balance renders as `0` in edit mode (plan G10) |
| TC-67, TC-97 | Edit and archive controls hidden from non-owners | Expected to fail — the page ignores the member's role (plan G11) |
| TC-78 | Institution and masked number can be emptied | Expected to fail — empty is indistinguishable from absent (plan G12) |
| TC-109 | A repeated archive is audited | Expected to fail for the repeat branch — it raises without an audit row (plan G13) |

## Coverage summary

| User story | ACs | Integration TCs | E2E TCs |
|---|---|---|---|
| ACC-US-01 Create | 22 (+6 EC) | 27 | 7 |
| ACC-US-02 View | 20 (+3 EC) | 12 | 13 |
| ACC-US-03 Edit | 22 (+1 EC) | 19 | 7 |
| ACC-US-04 Archive | 20 (+4 EC) | 18 | 10 |
| **Total** | **84 AC + 14 EC** | **76** | **37** |

Every AC and every edge case has at least one case.
