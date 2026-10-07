# Wallet Time Zone — Impact Map and Plan

**Status:** Implemented (2026-10-06)
**Brief:** [timezone.md](timezone.md). This file records what the repository audit found and how the brief maps onto this codebase.

## Rule

An instant (`TIMESTAMPTZ`) stays an instant. A wallet calendar day is that instant read in `wallets.time_zone`, an IANA name. Every wallet-level day, month, window, "today" and day grouping uses the wallet's zone, never UTC and never the viewer's device zone. Calendar dates (`DATE`) stay timezone-free.

## Audit: every instant ↔ day site

The class numbers are the brief's §8 categories:
1. absolute instant;
2. calendar date;
3. wallet-local;
4. display;
5. intentionally UTC.

| Site | Today | Class | Change |
|---|---|---|---|
| `contracts/calc.ts` `isWithinPeriod` → `slice(0, 10)` | UTC day of an instant | 3 | takes `timeZone`; day via `dayOfInstant` |
| `calc.ts` `countsAsPeriodActivity`, `calculateBudgetSpent` | call the above | 3 | thread `timeZone` (`BudgetSpendInput.timeZone`) |
| `calc.ts` `budgetWindow`, `monthsAfter`, `utcDate`, `isoDay` | UTC `Date` used purely as calendar arithmetic on `YYYY-MM-DD` | 2 | none |
| `server/common/utc-day.ts` `todayUtc`, `dayAfter` | UTC today; UTC midnight bound | 3 | removed; replaced by contracts `todayIn` / `dayRange` |
| `transactions.service.ts:284` list `dateFrom/dateTo` | UTC midnight bounds | 3 | wallet-zone half-open bounds; across all wallets, each row judged in its paying wallet's zone (SQL `AT TIME ZONE`) |
| `dashboard.service.ts:180` period query, `resolvePeriod` default month, `todayUtc` | UTC | 3 | wallet zone |
| `budget-spend.ts:49` span bounds | UTC | 3 | wallet zone |
| `budgets.service.ts` default `activeOn` | `todayUtc()` | 3 | wallet today |
| `audit.service.ts:100` audit `dateFrom/dateTo` | UTC | 3 | wallet zone (the audit trail is per wallet) |
| `exchange-rate.service.ts:387,392` | provider snapshot date | 5 | none |
| `ai` `monthSummary` | calls the dashboard default period | 3 | inherits the wallet zone |
| mobile `utils/date.ts` `dayOfInstant` → `slice(0, 10)` | UTC | 3 | re-exports the contracts `dayOfInstant(instant, timeZone)` |
| mobile `today()` | device-local | 3 | `today(timeZone)` |
| mobile `instantOfDay` (12:00Z), `replaceDay` (swaps the UTC date) | UTC workaround | 3 | `middayOf(day, tz)`, `withDay(instant, day, tz)`, keeping the wall-clock time in the wallet zone |
| mobile `startOfMonth`…`endOfYear`, `windowFor`, `monthGrid`, `addMonths` | pure calendar arithmetic | 2 | none (the default `today()` argument removed) |
| mobile `formatTimeOfDay`, `formatSavedAt`, `createdAt` display | device-local display | 4 | unchanged (§15: no product rule says otherwise) |
| mobile `TransactionDetailModal:135`, `GoalDetailModal:191` (`slice(0, 10)` of an instant) | UTC day shown | 3 | wallet day |
| mobile `ActionProposalCard` date | UTC | 3 | wallet day |
| mobile `ConversationHistorySheet`, `InvitationRow` | not wallet-calendar | 4 | unchanged |
| mobile `groupByDate` | UTC | 3 | wallet zone |
| mobile `pendingTotals`, `optimisticRecords` | UTC | 3 | wallet zone (from `BudgetResponse.timeZone` / `DashboardResponse.period.timeZone`) |
| guest `guestDashboard`, `guestBudgets` `todayUtc`, `guestTransactions` filter | UTC | 3 | guest wallet zone |

## Decisions

- **Column:** `wallets.time_zone VARCHAR(64) NOT NULL`, no default; every insert path names it. `chk_wallet_time_zone` checks the name against `pg_timezone_names` through `is_iana_time_zone()`, as the backstop for writers other than the API (Part 7 rule 4).
- **Validation:** `timeZoneSchema` accepts a name only if it starts with a letter (so no `+07:00`) and `Intl.DateTimeFormat` accepts it. It is stored canonicalized (`resolvedOptions().timeZone`). No homegrown list, no new dependency.
- **Required on every wallet-creating request:** register, Google sign-in, `POST /wallets`. Optional on `PATCH /wallets/{id}`, which stays OWNER-only. The app sends the device zone (`Intl.DateTimeFormat().resolvedOptions().timeZone`).
- **One utility:** `packages/contracts/src/calendar.ts` holds `dayOfInstant`, `todayIn`, `startOfDay`, `dayRange`, `zonedInstant` and `canonicalTimeZone`. It uses `Intl`, so DST follows the runtime's tz database with no fixed offsets. The server and app both import it.
- **Query bounds:** for a single wallet, computed in JS by the same utility, so SQL stays index-friendly (`transaction_date >= start AND < end`). For the all-wallets transaction list, SQL `AT TIME ZONE` against the joined wallet.
- **Self-describing responses:** `WalletResponse.timeZone`, `BudgetResponse.timeZone` and `DashboardResponse.period.timeZone`, so the app's optimistic maths reads the zone from the cached object it patches.
- **Timestamp display** stays in the device zone (class 4). Only calendar grouping and wallet maths move.

## As built

- **Sign-up and Google sign-in** send the device zone silently. Sign-up already asks for a language, and the owner can change the zone in the wallet's settings.
- **New wallets:** `POST /wallets` from the app shows a time-zone field, defaulted to the device zone.
- **Guest upload** creates its wallet in the device zone.
- **Changing the zone** happens in `WalletEditCard`, which is owner-only, and asks for confirmation first, because it can move figures between days and change totals.
- **The guest wallet** takes the device zone when seeded. A store saved before zones existed reads in the device zone (`guestTimeZone`).
- **Cached data from older versions** (wallets, budgets or dashboards without a zone) falls back to the device zone until it refetches.
- **The picker's options** are suggested modern IANA names plus whatever `Intl.supportedValuesOf` lists. V8 lists legacy names (`Asia/Saigon`), so the suggestions keep "Ho Chi Minh" findable. Validation never relies on that list.
- **Times stay on the device:** row and detail times (`formatTimeOfDay`) and the created-at line show device time. Only days follow the wallet.

## Checklist

- [x] Phase 2 — schema column + check function, constraint probes, test fixtures
- [x] Phase 3 — `calendar.ts`, calc.ts threading, schemas, responses, contracts tests (VN boundary, LA negative offset, New York DST)
- [x] Phase 4 — server: wallets, auth seeding, transactions filter, dashboard, budgets, audit; `utc-day.ts` removed
- [x] Phase 5 — API spec §2/§5/§6/§11/§12/§14/§15, SRS/SDS, domain design, CLAUDE.md rule 18 + ports, test plans, parity
- [x] Phase 6 — mobile: date utils, wallet create/edit time-zone picker with confirm, grouping, form date, dashboard/planning, guest store, sync maths
- [x] Phase 7 — tests: midnight, early morning, month boundary, negative offset, DST, shared wallet, date picker, filters
- [x] Phase 8 — typecheck, `npm test`, parity, scratch-DB server suite + constraints, expo export; report
