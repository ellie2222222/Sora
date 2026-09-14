# FX Resilience, Stale Rates & Daily Rate History

The existing multi-currency and exchange-rate implementation is already complete.

**Do not reimplement or redesign the existing currency architecture.**

This task is an incremental enhancement focused on:

1. handling unavailable exchange rates safely
2. supporting stale-rate fallback where appropriate
3. preserving exact native financial data
4. introducing daily exchange-rate snapshots for historical valuation
5. making converted totals transparent and trustworthy

Inspect the existing implementation first and extend it using the current models, services, cache, contracts, error handling, and dashboard flow.

---

## 1. Core Financial Rule

Native financial data remains authoritative.

Never modify:

* transaction amount
* transaction currency
* account currency
* historical balances
* wallet financial data

because of exchange-rate changes.

Exchange rates are only used for **derived valuation**.

```text
Native financial data
        ↓
Exchange-rate valuation
        ↓
Converted display value
```

---

# 2. Distinguish Three Rate States

The valuation layer must distinguish:

```text
fresh
stale
unavailable
```

### Fresh

A valid rate exists within the normal cache policy.

Use it normally.

### Stale

The external provider cannot be reached, but a previously stored rate exists.

Use the stale rate only if the existing product policy allows stale fallback.

The response must explicitly indicate that the valuation is stale.

### Unavailable

No usable rate exists.

Do not calculate a partial or misleading converted total.

---

# 3. Converted Total Rules

A converted total must only be marked as complete when **every currency contributing to the total has a valid conversion path**.

Example:

```text
VND
USD
JPY
```

If:

```text
VND → target ✅
USD → target ✅
JPY → target ❌
```

do not calculate:

```text
VND + USD
```

and pretend it represents the total.

Instead return:

```text
status: unavailable
missingCurrencies: ["JPY"]
```

The native per-currency values must remain available.

---

# 4. Valuation Response

Extend the existing valuation response rather than creating a parallel dashboard API.

The valuation should expose enough information for the client to render the correct state.

Conceptually:

```json
{
  "currency": "VND",
  "amount": "30450000",
  "status": "fresh",
  "rateTimestamp": "2026-09-14T08:00:00Z"
}
```

Stale:

```json
{
  "currency": "VND",
  "amount": "30450000",
  "status": "stale",
  "rateTimestamp": "2026-09-13T08:00:00Z"
}
```

Unavailable:

```json
{
  "currency": "VND",
  "amount": null,
  "status": "unavailable",
  "missingCurrencies": ["JPY"]
}
```

Use the existing contract naming conventions if equivalent fields already exist.

Do not create duplicate concepts.

---

# 5. User Experience

## Fresh

Show:

```text
≈ ₫30.45M
```

Optional supporting text:

> Based on recent exchange rates.

## Stale

Show the converted value but make the state clear:

```text
≈ ₫30.45M

Using a previous exchange rate
```

Provide:

> Try again

where appropriate.

Do not falsely imply the value is current.

## Unavailable

Show:

```text
≈ —
Conversion unavailable
```

Optionally:

> Couldn't get a rate for JPY.

Provide:

> Try again

Native per-currency values must remain visible.

---

# 6. Never Hide Incomplete Valuation

Do not:

* silently omit a currency
* return a partial total as complete
* substitute zero for a missing currency
* use a random/default rate
* use yesterday's rate without identifying it as stale
* block the entire dashboard

The dashboard should degrade gracefully.

---

# 7. Daily Exchange-Rate Snapshot

Introduce a persistent daily exchange-rate history for reproducible historical valuation.

This is **not a replacement for the existing 12-hour cache**.

Use:

```text
Cache
→ current/recent valuation performance

Daily snapshot
→ historical valuation/reproducibility
```

---

# 8. Daily Snapshot Storage

Prefer one daily snapshot per system base currency rather than storing every currency pair independently, provided the existing architecture allows it.

Conceptually:

```text
exchange_rate_daily
-------------------
date
base_currency
rates
source
fetched_at
```

Example:

```json
{
  "date": "2026-09-14",
  "baseCurrency": "USD",
  "rates": {
    "VND": 25100,
    "JPY": 147.2,
    "EUR": 0.85
  }
}
```

Reuse the project's existing JSON/JSONB conventions if available.

Do not create a new database abstraction if an existing flexible configuration/rate structure is already suitable.

---

# 9. Daily Snapshot Purpose

The daily snapshot exists to support:

* historical reports
* historical dashboard valuation
* reproducible calculations
* auditing/debugging
* future analytics

It must not overwrite native transaction/account data.

Example:

```text
Transaction
100 USD
2026-09-14

Daily rate
1 USD = 25,100 VND
```

Historical valuation can therefore consistently derive:

```text
100 USD → 2,510,000 VND
```

even if the current rate later becomes:

```text
1 USD = 26,000 VND
```

---

# 10. Snapshot Creation

At most one authoritative snapshot should be created for a given:

```text
date + base currency
```

Do not create duplicates from repeated dashboard requests.

Use an idempotent insert/upsert strategy.

Do not fetch from the provider every time a user opens the dashboard.

---

# 11. Which Rate Should Populate the Daily Snapshot?

Use the existing exchange-rate provider configuration.

The daily snapshot should contain the rate set actually retrieved from the provider, along with:

```text
fetchedAt
source
```

The snapshot date and provider fetch timestamp must be kept distinct.

For example:

```text
valuation date: 2026-09-14
fetchedAt: 2026-09-14T08:32:11Z
```

Do not pretend a rate was available at midnight simply because the snapshot belongs to that calendar date.

---

# 12. Current Dashboard vs Historical Reports

Define the behavior explicitly.

### Current dashboard

Use:

```text
12-hour cache
→ refresh when expired
→ stale fallback if allowed
```

### Historical report

Use:

```text
daily exchange-rate snapshot
→ rate corresponding to the requested date
```

Do not use the current rate to rewrite the meaning of historical reports.

---

# 13. Missing Historical Rate

If a historical date has no daily snapshot:

Do not silently use today's rate.

Return an explicit unavailable valuation state.

Example:

```json
{
  "status": "unavailable",
  "missingDates": ["2026-09-10"]
}
```

Only introduce interpolation or nearest-day fallback if it is explicitly defined as a product rule.

For the initial implementation, prefer correctness over guessing.

---

# 14. Provider Failure

When the external provider is unavailable:

```text
Request
   ↓
Cache valid?
   ├── yes → use cache
   └── no
        ↓
Daily snapshot available?
   ├── yes → optional stale fallback
   └── no → unavailable
```

Do not block native financial data.

A failed FX provider must never turn:

```text
Dashboard
```

into:

```text
Network Error
```

---

# 15. Provider and Cache Policy

Preserve the existing environment configuration:

```env
EXCHANGE_RATE_API_URL=https://open.er-api.com/v6/latest
EXCHANGE_RATE_TIMEOUT_SECONDS=5
EXCHANGE_RATE_CACHE_TTL_MINUTES=720
```

Do not change these defaults unless necessary.

Continue using the existing timeout and 12-hour cache.

The daily table is persistent history; it is not a replacement for the cache.

---

# 16. Error Handling

Use the existing canonical `ErrorCode` system.

Add a code only if an appropriate existing code does not exist.

Potential semantic code:

```text
EXCHANGE_RATE_UNAVAILABLE
```

or an equivalent existing valuation-oriented code.

Do not expose provider-specific errors such as:

```text
ER_API_TIMEOUT
HTTP_503_FROM_EXCHANGE_PROVIDER
FETCH_FAILED
```

User-facing wording remains local i18n.

---

# 17. Localization

Add translations for:

```text
errors.exchangeRateUnavailable
valuation.usingStaleRate
valuation.convertedEstimate
valuation.rateUnavailable
valuation.tryAgain
```

Use natural wording.

Example:

English:

> Conversion unavailable

> Using a previous exchange rate

Vietnamese:

> Không thể quy đổi

> Đang sử dụng tỷ giá trước đó

Do not expose technical terms such as:

> stale cache

> provider timeout

> exchange-rate service failure

---

# 18. Client Behavior

The mobile client must render the valuation based on server-provided status.

Example:

```text
fresh
→ show converted amount normally

stale
→ show converted amount + stale indicator

unavailable
→ show "—" + explanation + retry
```

The client should not attempt to recreate exchange-rate calculations using provider APIs itself.

Keep rate fetching/caching/history on the server.

---

# 19. Rate Calculation

Use the existing money/decimal utilities.

Do not use raw JavaScript floating-point arithmetic for financial calculations if a decimal-safe utility already exists.

Do not round native financial data.

Only round the final converted display value according to existing currency-formatting rules.

Keep conversion logic in one server-side service.

---

# 20. Testing

Add or update tests for:

### Current valuation

* fresh rate
* stale cache
* unavailable rate
* mixed currencies
* missing currency rate
* same-currency conversion

### Daily snapshots

* first snapshot of the day
* repeated request does not duplicate
* snapshot retrieval
* historical conversion
* missing historical snapshot
* provider failure after snapshot exists

### Dashboard

* all native currencies still displayed
* fresh converted total
* stale converted total
* unavailable converted total
* retry recovery
* valuation currency switching

### Regression

Verify that:

* native balances do not change
* transactions do not change
* account currencies do not change
* transfers remain currency-safe
* existing dashboard behavior remains intact

---

# 21. Verification

Run the existing project checks:

```bash
npx tsc --noEmit
npm test -w @sora/contracts
npm test -w @sora/server
```

Also inspect the database after testing to confirm:

* only one daily snapshot exists per date/base currency
* no transaction amount was modified
* no account currency was modified
* stale fallback is correctly identified
* unavailable conversion never produces a fake total

---

# 22. Non-Goals

Do not:

* redesign the existing multi-currency model
* rewrite historical financial data
* add a second FX provider
* call the provider directly from mobile
* introduce a second caching mechanism
* automatically guess missing historical rates
* calculate partial totals and label them complete
* make exchange rate data authoritative financial data
* refactor unrelated systems

---

# Final Rule

The system should always prefer:

```text
Exact native values
        ↓
Complete conversion
        ↓
Converted total
```

If conversion cannot be completed:

```text
Exact native values
        ↓
Conversion unavailable
```

Never:

```text
Missing rate
        ↓
Guess
        ↓
Fake complete total
```

**Financial truth must remain available even when valuation is not.**
