# Multi-Currency Architecture — Master Implementation Plan

Audit and refine the existing Sora finance system to support **multi-currency accounts with exact native-currency data**, while optionally providing a **converted total view** for users.

This is an incremental refinement.

**Do not rewrite the existing architecture, financial model, API structure, or unrelated functionality.**

Inspect the current implementation first and reuse existing models, contracts, services, providers, components, design-system tokens, and i18n infrastructure wherever possible.

---

# 1. Core Financial Principle

Sora is fundamentally a **multi-currency ledger**, not a currency-conversion system.

Every monetary value stored by the system must retain its **original/native currency**.

Example:

```text
Wallet: VND

Account A
Currency: USD
Balance: $1,000

Account B
Currency: JPY
Balance: ¥50,000

Account C
Currency: VND
Balance: ₫5,000,000
```

Never silently convert and overwrite these native values.

The native amount + native currency is the authoritative financial data.

---

# 2. Account Currency

Every account has exactly one currency.

Example:

```text
Account
├── id
├── name
├── currency: USD
└── balance
```

The currency should be an explicit field in the existing account model.

Reuse the existing currency enum/type if one already exists.

Do not introduce a second currency representation.

---

# 3. Transaction Currency

For the current product scope:

```text
Transaction currency = Account currency
```

A transaction belonging to an account must use that account's currency.

Do not introduce cross-currency transactions unless the existing system already supports them.

Example:

```text
USD Account
└── Transaction
    ├── amount: 100
    └── currency: USD
```

Do not silently convert:

```text
$100 → ₫2,500,000
```

and replace the stored amount.

---

# 4. Multi-Currency Transfers

Transfers are only allowed between accounts with the same currency.

Valid:

```text
USD → USD
VND → VND
JPY → JPY
```

Invalid:

```text
USD → JPY
USD → VND
JPY → VND
```

Return the canonical error:

```text
ACCOUNT_CURRENCY_MISMATCH
```

The server must validate this independently of the client.

Do not trust frontend validation.

---

# 5. Wallet Currency

A Wallet has a configured **base/default currency**.

Example:

```text
Wallet
baseCurrency: VND
```

This does **not** mean all financial data is converted to VND.

It means:

* default reporting/view currency
* default currency for newly created accounts where appropriate
* default currency shown in wallet-level UI
* default currency for converted dashboard totals when conversion is available

The underlying account and transaction currencies remain unchanged.

---

# 6. Changing Account Currency

Changing an account's currency requires careful handling.

## Empty account

If the account has no transactions and no meaningful balance/history:

Allow:

```text
USD → EUR
```

without creating a new account.

## Account with history

Do not silently change:

```text
USD → EUR
```

if the account already contains transactions or historical financial data.

Instead, explain:

> This account already contains USD transactions. Create a new EUR account to keep your history accurate.

Prefer creating a new account rather than modifying the historical meaning of existing records.

Do not rewrite historical transactions.

---

# 7. Exact Native-Currency Storage

Preserve the existing multi-currency isolation principle.

The server must not:

* automatically convert every amount to wallet currency
* rewrite historical amounts
* replace native amounts with converted values
* depend on an arbitrary exchange-rate API
* store fake converted balances as authoritative financial data

Example:

```text
Transaction:
amount = 100
currency = USD
```

must remain:

```text
100 USD
```

regardless of the current VND/USD exchange rate.

---

# 8. Per-Currency Aggregation

When aggregating data across currencies, the authoritative backend response should be **per-currency**.

Example:

```json
[
  {
    "currency": "VND",
    "amount": "5000000"
  },
  {
    "currency": "USD",
    "amount": "1000"
  },
  {
    "currency": "JPY",
    "amount": "50000"
  }
]
```

Never add different currencies directly.

Do not return:

```text
total = 5,000,000 + 1,000 + 50,000
```

as though those numbers represented the same unit.

---

# 9. Dashboard Currency UX

The dashboard should support **both exact per-currency values and an optional converted total**.

## Default view

Show the wallet's native/base currency first.

Example:

```text
Total balance

VND       ₫5,000,000
USD       $1,000
JPY       ¥50,000
```

This is the exact financial view.

Do not imply that these values can be summed without conversion.

---

# 10. "Total Everything" View

Users should also be able to see a single total across all currencies.

This is a **converted valuation**, not native financial data.

Example:

```text
Total balance
[ VND ▼ ]

≈ ₫30,450,000
```

The total may be calculated from:

```text
VND
+
converted USD
+
converted JPY
```

Use the `≈` symbol or another clear visual indicator to communicate that the value is an estimate/conversion.

The UI should make the distinction clear:

> Converted values are estimates.

Do not present the converted value as though it were an exact ledger amount.

---

# 11. Conversion Architecture

The current system does not depend on a third-party exchange-rate API and does not store conversion snapshots.

**Do not introduce one automatically.**

Before implementing the "total everything" feature, inspect the existing project for any existing exchange-rate/rate infrastructure.

If none exists, introduce the **smallest explicit valuation mechanism required**.

Possible implementations include:

### Manual/user-defined rates

Example:

```text
1 USD = 25,000 VND
1 JPY = 170 VND
```

### Controlled/static rate source

The application maintains a defined set of rates.

### External provider

Only introduce this if explicitly approved later.

Do not silently add a third-party API dependency merely to calculate dashboard totals.

Most importantly:

> Conversion must never mutate native financial data.

Conversion is a presentation/valuation layer only.

---

# 12. Dashboard Currency Selector

Allow the user to choose the currency in which the converted total is displayed.

Example:

```text
Total balance

[ VND ▼ ]

≈ ₫30,450,000
```

Available choices should normally include:

* wallet base currency
* currencies currently represented by accounts in the wallet

Example:

```text
VND
USD
JPY
```

Selecting USD means:

> Show the estimated total value in USD.

It does not mean:

> Change the Wallet currency to USD.

It must not modify the Wallet or Account configuration.

---

# 13. Distinguish These Concepts

Do not confuse:

```text
Account currency
Wallet base currency
Dashboard display/valuation currency
```

### Account currency

Currency physically represented by that account.

```text
Cash → VND
US Bank → USD
Japan Bank → JPY
```

### Wallet base currency

The wallet's default reporting currency.

```text
Wallet → VND
```

### Dashboard valuation currency

Temporary presentation preference.

```text
Dashboard → USD
```

Changing dashboard valuation currency must not modify wallet/account configuration.

---

# 14. Exchange Rate Semantics

If conversion is introduced, document exactly what a rate means.

Example:

```text
1 USD = 25,000 VND
```

Define:

* source
* effective date/time
* direction
* precision
* rounding
* missing-rate behavior

Do not use an undefined "latest rate" concept without deciding what happens to historical reports.

If a historical report is converted using rates, the valuation date/rate policy must be explicit.

Do not silently use today's exchange rate to imply that every historical transaction had that value unless that is intentionally the product behavior.

---

# 15. No Historical Data Mutation

Never change:

```text
amount
currency
transaction date
historical balance
```

just because an exchange rate changes.

For example:

```text
Jan 10
$100 USD
```

must remain:

```text
$100 USD
```

even if the current rate changes dramatically.

Converted values are derived views.

---

# 16. Currency-Aware Dashboard Statistics

All dashboard aggregates must respect currency.

Examples:

```text
Income:
VND 5,000,000
USD 1,000
JPY 50,000
```

The user can either:

### View exact breakdown

```text
VND
₫5,000,000

USD
$1,000

JPY
¥50,000
```

### View converted total

```text
≈ ₫30.45M
```

Never combine native amounts before conversion.

---

# 17. Default Wallet / Account Currency

When creating the user's default Wallet or Account, use the user's current locale/preferences to determine the initial default currency only if the existing product rules already associate locale with currency.

Do not assume language automatically means currency when the product already has explicit currency settings.

Prefer an explicit user/country/currency preference when available.

Important distinction:

> **Locale is not necessarily currency.**

For example, English users can use USD, GBP, SGD, AUD, etc.

If the existing product has a clear locale-to-default-currency rule, preserve it.

---

# 18. Localized Default Names

Default wallet/account names may initially be created using the user's current locale.

Example:

```text
English → My Wallet
Vietnamese → Ví của tôi
```

Once persisted, the name becomes normal user-owned data.

Changing the application language must **not automatically rename the wallet/account**.

Example:

```text
Create:
"Ví của tôi"

Later switch app language:
English

Wallet remains:
"Ví của tôi"
```

The user can manually edit it.

Do not store:

```text
wallet.defaults.personal
```

as the wallet's actual name.

Store the resolved string:

```text
Ví của tôi
```

The same principle applies to user-owned default account/category names.

---

# 19. System Categories vs User Data

Keep this distinction explicit.

### User-owned data

Do not translate dynamically:

```text
Wallet name
Account name
Category name
Transaction description
Goal name
Budget name
Notes
```

### System-provided template content

May be localized by key if intentionally designed that way:

```text
food
transport
salary
shopping
```

Do not accidentally pass arbitrary database values through `t()`.

---

# 20. API Error Architecture

Use stable machine-readable error codes.

The server should expose:

```json
{
  "error": {
    "code": "ACCOUNT_CURRENCY_MISMATCH"
  }
}
```

The client translates locally.

Do not use user-facing English/Vietnamese messages as the primary API contract.

---

# 21. ErrorCode Naming Convention

All codes in `@sora/contracts` must follow:

```text
<RESOURCE>_<CONDITION>
```

Use `UPPER_SNAKE_CASE`.

Examples:

```text
WALLET_NOT_FOUND
ACCOUNT_NOT_FOUND
TRANSACTION_NOT_FOUND
CATEGORY_IN_USE
ACCOUNT_ARCHIVED
INVITATION_EXPIRED
INVITATION_REVOKED
TRANSFER_SAME_ACCOUNT
ACCOUNT_CURRENCY_MISMATCH
INSUFFICIENT_BALANCE
```

Use a singular resource.

Prefer:

```text
WALLET_NOT_FOUND
```

over:

```text
NOT_FOUND_WALLET
```

Do not embed IDs or dynamic values.

Bad:

```text
WALLET_123_NOT_FOUND
```

Use action-specific errors when necessary:

```text
TRANSACTION_CREATE_FAILED
INVITATION_ACCEPT_FAILED
```

but prefer a specific semantic condition when possible:

```text
INSUFFICIENT_BALANCE
```

instead of:

```text
TRANSFER_FAILED
```

Avoid synonyms for the same meaning.

---

# 22. API → i18n Mapping

Map:

```text
ACCOUNT_NOT_FOUND
```

to:

```text
errors.accountNotFound
```

Map:

```text
ACCOUNT_CURRENCY_MISMATCH
```

to:

```text
errors.accountCurrencyMismatch
```

The mapping should be predictable:

```text
UPPER_SNAKE_CASE
        ↓
camelCase
```

Do not create unrelated translation names.

---

# 23. Centralized Error Helper

The mobile app should have one centralized helper:

```ts
getServerErrorMessage(error, t)
```

It should:

1. Safely extract the server error code.
2. Check that it is a known `ErrorCode`.
3. Map it to the appropriate i18n key.
4. Handle optional parameters.
5. Fall back to a generic localized message.
6. Never expose raw technical error text.

Do not duplicate error-code mapping logic throughout screens.

---

# 24. Network Errors

Network availability is different from server application errors.

Do not force:

```text
offline
timeout
connection unavailable
```

into the server ErrorCode model when they are client-side conditions.

Use local i18n for:

```text
No internet connection.
Couldn't connect right now.
Couldn't sync your data.
```

Keep offline behavior compatible with the existing local-storage/guest architecture.

The app should not become unusable merely because the network is unavailable.

---

# 25. Screen State Architecture

Every screen should preserve its structural shell.

Do not use:

```tsx
if (isError) return <StateView />;
```

if that removes:

* screen header
* wallet context
* navigation
* bottom tabs
* persistent actions
* screen identity

Instead:

```text
Screen Shell
├── Header / navigation context
├── Persistent controls
├── Content area
│   ├── Loading
│   ├── Error
│   ├── Empty
│   └── Actual content
└── Persistent actions
```

The error/loading/empty state should replace the **smallest meaningful content boundary**.

Only use a full-screen error when the screen genuinely cannot continue.

---

# 26. Empty, Error, Loading, and Offline States

Use the shared state system consistently:

```text
StateView
├── empty
├── error
├── no-results
└── informational

LoadingState

Skeleton
```

`StateView` should support:

* custom icon
* custom title
* custom message
* primary action
* secondary action
* retry action

Do not create separate one-off empty/error layouts for each screen.

---

# 27. UX for "Total Everything"

The dashboard should communicate the distinction clearly.

Recommended:

```text
Total balance
[ VND ▼ ]

≈ ₫30.45M

Across 3 currencies
```

Optional supporting information:

> Converted values are estimates.

Do not make the converted total look identical to an authoritative native balance.

Native breakdown should remain accessible:

```text
VND       ₫5.00M
USD       $1,000
JPY       ¥50,000
```

The user should always be able to inspect the underlying currency breakdown.

---

# 28. Rounding and Display

Native amounts should preserve the system's existing exact monetary representation.

Converted totals may use display rounding, but:

* do not round stored native values
* do not round before aggregation when avoidable
* use consistent currency decimal rules
* clearly label estimates

Reuse the project's existing money formatting utilities if available.

Do not introduce multiple currency-formatting systems.

---

# 29. Architecture Boundaries

Keep responsibilities separated:

```text
Database
→ exact native financial data

Domain / Server
→ business rules + currency validation

Contracts
→ stable API enums/error codes

Client
→ presentation + valuation display

i18n
→ human language

Exchange-rate mechanism
→ conversion data only
```

Do not allow:

* translated strings to become domain values
* currency conversion to mutate ledger data
* UI-specific strings to become API contracts
* API error messages to become business logic
* localization logic inside financial calculations

---

# 30. Implementation Strategy

Work incrementally.

### Phase 1 — Inspect

Inspect:

* current wallet model
* account model
* transaction model
* transfer logic
* currency enum
* wallet dashboard aggregation
* existing i18n
* existing ErrorCode
* existing AppError
* local storage
* exchange-rate infrastructure, if any

Do not assume the current implementation matches this document.

### Phase 2 — Contracts

Make the canonical currency and error contracts complete.

### Phase 3 — Backend

Ensure:

* native currency remains authoritative
* transfer currency rules are enforced
* aggregation remains per currency
* errors use stable codes
* no unnecessary localized messages are returned

### Phase 4 — Client

Implement:

* centralized error translation
* localized error keys
* multi-currency display
* optional converted-total view
* currency selector

### Phase 5 — UI

Refine:

* dashboard hierarchy
* per-currency breakdown
* converted total presentation
* clear estimate labeling
* account currency editing rules

### Phase 6 — Verification

Test all supported states and currency combinations.

---

# 31. Important Non-Goals

Do not:

* rewrite the financial domain model
* convert all historical records
* automatically change account currencies
* add a third-party rate API without approval
* introduce a second localization system
* create translated values in the database
* make dashboard totals look exact when they are converted estimates
* expose raw backend error messages
* refactor unrelated screens

---

# 32. Verification Checklist

## Currency

* [ ] Every account has a currency.
* [ ] Transactions preserve native currency.
* [ ] Same-currency transfers work.
* [ ] Cross-currency transfers return `ACCOUNT_CURRENCY_MISMATCH`.
* [ ] Native historical data is never mutated.
* [ ] Empty accounts may change currency where appropriate.
* [ ] Accounts with history are protected from unsafe currency changes.

## Dashboard

* [ ] Per-currency totals are accurate.
* [ ] Different currencies are never summed directly.
* [ ] Wallet base currency is the default view.
* [ ] User can view each currency separately.
* [ ] User can view a converted total when a valid conversion source exists.
* [ ] Converted totals are clearly marked as estimates.
* [ ] Changing dashboard currency does not modify wallet/account data.

## Localization

* [ ] UI strings come from i18n.
* [ ] Error codes map centrally to i18n.
* [ ] All supported locales contain required keys.
* [ ] Unknown server codes fall back safely.
* [ ] User-generated data is never accidentally translated.

## Error handling

* [ ] Server uses canonical ErrorCode.
* [ ] Raw `error.message` is not displayed to users.
* [ ] Internal server errors do not expose technical details.
* [ ] Network/offline states are handled separately.
* [ ] Errors remain scoped to the affected content area.

## Tests

Run:

```bash
npx tsc --noEmit
npm test -w @sora/contracts
npm test -w @sora/server
```

Also manually test:

* VND-only wallet
* USD-only wallet
* multiple currencies
* same-currency transfer
* cross-currency transfer
* account currency change
* empty account currency change
* converted dashboard total
* missing conversion rate
* offline mode
* unknown server error
* English
* Vietnamese

---

# Final Design Principle

The system should follow this hierarchy:

```text
Exact financial truth
        ↓
Native amount + native currency
        ↓
Per-currency aggregation
        ↓
Optional valuation/conversion layer
        ↓
Presentation
        ↓
Localized human language
```

The core principle is:

> **Never change financial truth to make presentation easier.**

Native currency data remains exact and immutable. Conversion is a separate, explicitly identified valuation layer. The server communicates machine-readable meaning, while the client controls how that meaning is presented to the user.

# Implement Exchange Rate Service and Converted Dashboard Totals

Implement the exchange-rate layer for Sora using the existing backend architecture.

The goal is to support **optional converted dashboard totals** without changing or rewriting any native financial data.

## Core Rules

* Native account and transaction amounts remain the source of truth.
* Never convert and overwrite stored amounts.
* Never store converted balances as authoritative financial data.
* Exchange rates are used only for derived valuation/display.
* The server is responsible for fetching, caching, validating, and serving exchange rates.
* The client should request converted totals from the server rather than calling the exchange-rate provider directly.
* Reuse the existing service/config/module patterns.
* Do not introduce a second currency system.

---

# 1. Environment Configuration

Add/use:

```env
EXCHANGE_RATE_API_URL=https://open.er-api.com/v6/latest
EXCHANGE_RATE_TIMEOUT_SECONDS=5
EXCHANGE_RATE_CACHE_TTL_MINUTES=720
```

Interpret:

```text
API URL
→ exchange-rate provider base endpoint

Timeout
→ maximum provider request duration

Cache TTL
→ 720 minutes = 12 hours
```

Do not hardcode these values in application logic.

Use the existing configuration/environment validation mechanism if one already exists.

---

# 2. Exchange Rate Provider

Create or reuse an exchange-rate service on the server.

The service should call:

```text
GET {EXCHANGE_RATE_API_URL}/{baseCurrency}
```

Example:

```text
GET https://open.er-api.com/v6/latest/USD
```

The provider response contains a base currency and rates for other currencies.

Do not expose the provider's raw response directly to the mobile application.

Normalize it into the application's own internal representation.

For example:

```ts
type ExchangeRates = {
  baseCurrency: CurrencyCode;
  rates: Record<CurrencyCode, number>;
  fetchedAt: string;
  expiresAt: string;
};
```

Adapt this to the existing project conventions rather than creating a duplicate currency model.

---

# 3. Cache

Use the existing server cache infrastructure if available.

Cache rates by base currency:

```text
exchange-rates:USD
exchange-rates:VND
exchange-rates:JPY
```

Each cached value should contain:

```text
base currency
rates
fetchedAt
expiresAt
```

TTL:

```text
EXCHANGE_RATE_CACHE_TTL_MINUTES
```

= 720 minutes.

This prevents unnecessary calls to the external provider.

Do not make a provider request for every transaction or every dashboard value.

---

# 4. Cache Lookup Flow

Use this order:

```text
Request conversion
      ↓
Check cache
      ↓
Cache valid?
   ├── yes → use cached rates
   └── no
         ↓
   request provider
         ↓
   validate response
         ↓
   cache result
         ↓
   use rates
```

If the cache is valid, do not call the provider.

---

# 5. Timeout

Provider requests must respect:

```text
EXCHANGE_RATE_TIMEOUT_SECONDS
```

Set the request timeout to 5 seconds by default.

A provider timeout must not cause the entire application/dashboard to fail.

Return a controlled application error or a clearly identifiable valuation failure.

Do not expose:

* raw HTTP client errors
* provider URLs
* stack traces
* internal timeout details

---

# 6. Provider Failure

The application should distinguish:

### Financial data

Still available from the database/local state.

### Exchange-rate failure

Only the **converted valuation** is unavailable.

For example:

```text
Native balances

VND    ₫5,000,000
USD    $1,000
JPY    ¥50,000
```

must still work if the exchange provider is unavailable.

The converted total may show:

> Converted total unavailable right now.

with:

> Try again

Do not replace the entire dashboard with a network error.

---

# 7. Rate Validation

Do not blindly trust the provider response.

Validate:

* response indicates success
* returned base currency matches requested base currency
* rate exists for every required target currency
* rate is finite
* rate is greater than zero
* currency codes are supported by Sora
* timestamps/metadata are valid where provided

Reject malformed provider responses.

Do not cache invalid data.

---

# 8. Supported Currencies

Use the application's existing canonical currency enum/type.

Do not create a separate list such as:

```ts
SUPPORTED_EXCHANGE_CURRENCIES
```

unless the existing architecture has no appropriate abstraction.

The exchange-rate service should only request/return currencies that Sora understands.

---

# 9. Conversion Direction

Define conversion consistently.

If provider returns:

```text
base = USD
rates.VND = 25,000
```

then:

```text
1 USD = 25,000 VND
```

To convert:

```text
100 USD → VND
```

calculate:

```text
100 × 25,000
```

For:

```text
1,000 JPY → USD
```

when the provider response is based on USD:

```text
1 USD = 150 JPY
```

calculate:

```text
1,000 / 150
```

Do not reverse rates incorrectly.

Create one centralized conversion utility/service and do not duplicate currency arithmetic throughout controllers/screens.

---

# 10. Avoid Floating-Point Money Errors

Do not use unrestricted JavaScript floating-point arithmetic for final monetary calculations if the project already has a decimal/money utility.

Reuse the existing money/decimal representation.

If no appropriate utility exists, introduce a small server-side decimal-safe calculation layer.

The important rule is:

> Exchange rates may be decimal values, but monetary calculations must preserve the application's existing precision rules.

Do not round native stored amounts.

Only round the final converted display value according to the target currency's display rules.

---

# 11. Dashboard Converted Total

Keep the existing per-currency aggregation.

Example:

```json
[
  {
    "currency": "VND",
    "amount": "5000000"
  },
  {
    "currency": "USD",
    "amount": "1000"
  },
  {
    "currency": "JPY",
    "amount": "50000"
  }
]
```

Add support for an optional converted total.

Example request concept:

```text
wallet dashboard
displayCurrency = VND
```

Server:

```text
per-currency native totals
        ↓
exchange rates
        ↓
convert each currency → VND
        ↓
sum converted values
        ↓
return derived total
```

The result should clearly be represented as a **converted valuation**, not a ledger balance.

---

# 12. Converted Total Response

Prefer a response structure that makes the distinction explicit.

For example:

```json
{
  "nativeTotals": [
    {
      "currency": "VND",
      "amount": "5000000"
    },
    {
      "currency": "USD",
      "amount": "1000"
    },
    {
      "currency": "JPY",
      "amount": "50000"
    }
  ],
  "valuation": {
    "currency": "VND",
    "amount": "30450000",
    "isApproximate": true,
    "rateTimestamp": "..."
  }
}
```

Adapt this to the existing dashboard contract.

Do not create a completely separate dashboard response model if the current response can be extended safely.

---

# 13. Rate Metadata

When returning a converted valuation, include enough metadata for the client to explain what it represents.

At minimum consider:

```text
valuation.currency
valuation.amount
valuation.isApproximate
valuation.rateTimestamp
```

Optionally:

```text
valuation.source
```

Do not expose unnecessary provider implementation details.

The client should be able to communicate:

> Converted values are estimates.

and optionally:

> Rates updated 12 hours ago.

Only show the latter if the timestamp is reliable and useful.

---

# 14. Dashboard Currency Selector

Allow the user to choose a valuation/display currency.

Possible options:

* wallet base currency
* currencies currently represented in the wallet

Example:

```text
Total balance
[ VND ▼ ]

≈ ₫30.45M
```

Selecting USD:

```text
Total balance
[ USD ▼ ]

≈ $1,218
```

This does **not** modify:

* wallet currency
* account currency
* transaction currency
* stored amounts

It only changes the valuation target.

---

# 15. Same-Currency Optimization

If every native total already uses the requested valuation currency:

```text
VND
```

then no external exchange-rate request is necessary.

For example:

```text
nativeTotals:
VND = 5,000,000
```

and:

```text
valuation currency = VND
```

Simply use:

```text
5,000,000
```

Do not call the provider just to convert:

```text
VND → VND
```

For mixed currencies:

```text
VND + USD + JPY
```

only fetch rates when conversion is actually required.

---

# 16. Partial Rate Availability

If one required currency has no valid exchange rate:

```text
VND
USD
XYZ
```

and XYZ cannot be converted, do not silently exclude XYZ and present an apparently complete total.

Prefer:

```text
Converted total unavailable
```

or an explicit incomplete valuation state.

Never pretend the result is complete.

---

# 17. Historical Valuation Policy

For the initial implementation, explicitly document the valuation policy.

The dashboard's converted total should use the currently cached exchange-rate set.

This is a **current valuation**, not a historical accounting valuation.

Therefore:

* native historical amounts remain unchanged
* dashboard converted total may change when exchange rates update
* historical reports should not silently imply that the current rate was the historical rate

If the product later needs historical exchange-rate accounting, introduce a separate historical-rate/snapshot design rather than extending this implicitly.

---

# 18. Client Behavior

The mobile app should not call:

```text
open.er-api.com
```

directly.

Use the Sora server API.

The client should receive:

```text
native totals
+
optional valuation
```

and display them.

This keeps:

* provider credentials/configuration
* caching
* timeout handling
* validation
* provider failures

on the server.

---

# 19. Error Handling

Add a dedicated application-level error only if necessary, using the established ErrorCode naming convention.

Potential code:

```text
EXCHANGE_RATE_UNAVAILABLE
```

or:

```text
VALUATION_UNAVAILABLE
```

Prefer the one that best matches the actual domain boundary.

Do not return:

```text
EXCHANGE_RATE_API_TIMEOUT
```

to the user.

That is an implementation detail.

Client translation example:

```text
errors.valuationUnavailable
```

> Couldn't calculate the converted total right now.

Native per-currency balances should remain available.

---

# 20. Logging

Log provider failures server-side with enough diagnostic information to troubleshoot:

* requested base currency
* target currencies
* HTTP status
* timeout
* provider response validity
* cache hit/miss
* timestamp

Do not log sensitive financial amounts unnecessarily.

Do not expose provider-specific errors to the client.

---

# 21. Testing

Add tests for:

### Provider

* successful response
* timeout
* HTTP failure
* malformed response
* missing rate
* zero/negative rate
* unsupported currency

### Cache

* cache hit
* cache miss
* expired cache
* successful refresh
* failed refresh
* invalid response is not cached

### Conversion

```text
USD → VND
JPY → USD
same currency → same currency
multiple currencies → target currency
```

### Dashboard

* single-currency wallet
* multi-currency wallet
* unavailable exchange rate
* one missing currency rate
* changing valuation currency
* native totals unaffected by conversion

### Regression

Verify:

* transactions unchanged
* account balances unchanged
* transfers unchanged
* wallet currency unchanged
* historical native amounts unchanged

---

# 22. Manual Verification

Test:

### VND-only wallet

```text
VND ₫5,000,000
```

Converted VND total should not call the provider.

### VND + USD

```text
VND ₫5,000,000
USD $1,000
```

Dashboard can show:

```text
≈ ₫...
```

### VND + USD + JPY

Display native breakdown and converted total.

### Provider unavailable

Native balances remain visible.

Converted total shows an appropriate unavailable state.

### Offline mobile

Do not display a fatal application error simply because valuation cannot refresh.

### Rate refresh

After cache expiration, verify the server refreshes rates and subsequent valuations update.

---

# 23. Keep Implementation Incremental

Before creating new files or abstractions:

1. Inspect the existing config system.
2. Inspect existing HTTP/client utilities.
3. Inspect existing cache infrastructure.
4. Inspect current currency model.
5. Inspect current dashboard aggregation.
6. Inspect current ErrorCode infrastructure.
7. Reuse existing patterns wherever possible.

Do not introduce:

* a second config system
* a second cache implementation
* a second money abstraction
* a second currency enum
* direct provider calls from mobile
* unrelated refactors

---

# Final Architecture

```text
Native financial data
        │
        ├── VND totals
        ├── USD totals
        └── JPY totals
                │
                ↓
        Dashboard valuation
                │
        selected currency
                │
                ↓
        ExchangeRateService
                │
        ┌───────┴────────┐
        │                │
     Cache          External API
        │                │
        └───────┬────────┘
                ↓
        Converted estimate
                ↓
             Mobile UI
```

### Environment

```env
EXCHANGE_RATE_API_URL=https://open.er-api.com/v6/latest
EXCHANGE_RATE_TIMEOUT_SECONDS=5
EXCHANGE_RATE_CACHE_TTL_MINUTES=720
```

### Fundamental rule

> **Exchange rates may change the dashboard's converted valuation, but they must never change the underlying financial records.**

The ledger remains exact. The converted total is a derived, approximate view.
