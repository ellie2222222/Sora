# Realistic Seed Data — Plan

**Status:** Draft — not implemented
**Goal:** one command fills a disposable database with a year of believable finance data across
several people and wallets, covering every transaction, budget, goal and category kind the schema
admits, so the app, the dashboard and the derivations can be exercised and demoed on non-trivial data.

Facts below were read from `db/migrations/001_schema.sql`, `packages/contracts/src/schemas.ts`,
`packages/contracts/src/starter-categories.ts`, `docs/API_SPECIFICATION.md` §§6–13 and the server
services. Open questions are in §9.

---

## 1. Approach

### 1.1 Seed through the API, not SQL

| | Through the API (chosen) | Raw SQL |
|---|---|---|
| Business rules (currency match, category type, roles, overlap, goal state) | Enforced by the real services | Must be re-implemented, will drift (Part 7 rule 7) |
| Starter categories | Created by `POST /auth/register` (`seedWallet`) | Must copy `STARTER_CATEGORIES` |
| Audit trail | Written as in production (LA-02), though every entry is dated the run instant (§8) | Empty or faked |
| Invitations | `POST /wallets/{id}/invitations` returns the token once; the invitee accepts with `POST /invitations/accept` | Must fake token hashes |
| Backdating `created_at` | Not possible — only `transactionDate`, `contributionDate`, budget `startDate` | Possible |
| Speed | ~2,800 requests (≈ 2,550 transaction writes, ≈ 170 setup, ≈ 80 verify reads), ~1–3 min locally | Seconds |

The cost of the API path is that `created_at` is always "now" (§8 handles it). Every other
property favours the API: the seed doubles as a broad end-to-end exercise of the write paths.

### 1.2 Where it lives

Follow the shape of `mobile/e2e/seed.mts`, which already runs TypeScript directly on Node 22.18 (CI
runs it). Reuse only the `ApiCaller`/`ApiResponse` types from `server/test/support/probe-data.ts`
(`../../server/test/support/probe-data.ts`). Registration, invitations with `relationLabel` and token
refresh are the seed's own: `registerProbeUser`/`addMember` hard-code `probe+` emails, send no
locale or relation label, and hold a fixed token.

Node only strips types, so the seed is erasable TypeScript only: no `enum`, `namespace` or parameter
properties (`@sora/contracts` uses none). Nothing typechecks `scripts/` today, `mobile/e2e/seed.mts`
included, so phase 1 adds `scripts/seed/tsconfig.json` (extending `tsconfig.base.json`, `noEmit`,
`erasableSyntaxOnly`) and folds it into the root `typecheck`.

```text
scripts/seed/
├── seed-demo.mts        # entry: guard → personas → phases → verify → write .env.seed
├── client.ts            # ApiCaller + bearer refresh on 401 (access token lives 15 min; a run can outlast it).
│                        #   One in-flight refresh per persona: refresh tokens are single-use, and a replay
│                        #   revokes the persona's whole token family (Security Requirements)
├── rng.ts               # seeded PRNG (mulberry32) — same SEED, same data
├── calendar.ts          # anchor date and Tet table; wallet-local times go through @sora/contracts'
│                        #   calendar.ts (zonedInstant, dayOfInstant, dayRange), never a hand-written offset
├── personas.ts          # declarative data: users, wallets, accounts, categories, goals, budgets
├── generators/
│   ├── recurring.ts     # salary, rent, bills, subscriptions, allowances, card payment
│   ├── habits.ts        # daily/weekly spending with probabilities and time windows
│   ├── events.ts        # one-off clusters: Tet, trips, 11.11, wedding season, repairs
│   └── corrections.ts   # edits, deletes, duplicates — the "real user mistakes" pass
└── verify.ts            # read-back invariants (§7)
```

Root script: `"db:seed": "node scripts/seed/seed-demo.mts"`.

### 1.3 Safety guard

- `SEED_API_URL` is required, no default (same rule as `E2E_API_URL`). Like it, it's
  `scheme://host:port` without `/api/v1`; `client.ts` appends `API_PREFIX` from `@sora/contracts`.
- Refuse a non-loopback host unless `SEED_ALLOW_REMOTE=yes` — the seed only *adds* data, but
  fake users in a shared or production database are themselves damage.
- **Loopback doesn't mean disposable.** `/health` doesn't name its database, so the guard can't see
  which one the API writes to, and the default local API writes to `sora_dev`. Run the API on a
  database created for the seed, as `mobile/e2e/README.md` does (e.g.
  `DATABASE_URL=…/scratch_seed_<id> PORT=3417 npm start -w @sora/server`, then
  `SEED_API_URL=http://127.0.0.1:3417`). `db:seed` writes only through the API and never reads
  `DATABASE_URL`, unlike the `db:*` scripts beside it.
- Every seeded email is `seed+<persona>-<runId>@example.invalid`, so any later clean-up can target
  exact identifiers only.
- `runId` (short, lowercase) and the passwords (24-character base64url) come from `node:crypto`,
  never from `rng.ts`. That keeps them unpredictable and leaves the data stream depending only on `SEED`.
- Output goes to `.env.seed` (matched by `.gitignore`'s `.env.*`): `SEED_API_BASE` (the URL with
  `/api/v1`, like `E2E_API_BASE`), `SEED`, the resolved anchor, `runId`, each persona's
  email/password, the wallet ids, and the sister's invitation token. The token is returned only by
  `POST /wallets/{id}/invitations` and is what `POST /invitations/preview` needs. **`seed.env`
  would not be ignored — don't use that name.** Every created id goes to `.seed/<runId>.json`, and
  phase 1 adds `.seed/` to `.gitignore`.
- The open invitation expires `INVITATION_TTL_DAYS` (7) after the run. After that it leaves the
  default `GET /wallets/{id}/invitations` list (`state=open`) and shows under `?state=expired`.
- Clean-up is "drop the disposable database" (asked for each time, per Data Safety), never
  row deletes. No clean-up code is part of this plan.

### 1.4 Write order

The seed writes in creation order, not story order. Every state change that blocks later writes runs only after the last write it would block:

| State change | Server effect | So it runs after |
|---|---|---|
| Archive ACB (old) | `ACCOUNT_ARCHIVED` on any new transaction naming it, or an edit that moves money (`TRANSACTION_MOVEMENT_FIELDS`) | its closing transfer and the corrections pass |
| Revoke Khoa on Shared House 2025 | he can no longer write there | his Shared House entries. Membership changes aren't blocked by an archived wallet (`members.service.ts`), but it runs before the archive to keep the story in order |
| Archive Shared House 2025 | `WALLET_ARCHIVED` on transaction writes and on creating accounts, categories, budgets or goals there; removing a transaction-backed contribution is refused too | everything else in that wallet |
| Archive Gym Membership | transactions don't check category status, but budgets do (`CATEGORY_ARCHIVED`). Archiving is refused while any budget names it or a descendant (`CATEGORY_IN_USE`), so no §6.2 budget may target it | its transactions; kept late so the story stays realistic |
| Complete Motorbike, cancel Learn Guitar | contributions need `ACTIVE` (`GOAL_NOT_ACTIVE`) | their contributions |

These all run in one final "state changes" step (§10, phase 6), through these routes:

| Change | Route |
|---|---|
| Archive an account | `DELETE /accounts/{id}`; the wallet must keep another active account (`ACCOUNT_LAST_ACTIVE`) |
| Archive a category | `DELETE /categories/{id}` (default `mode=archive`; also archives descendants) |
| Revoke a member | `DELETE /wallets/{id}/members/{memberId}`; `memberId` is the `wallet_members` id from `GET /wallets/{id}/members`, not the user id |
| Archive a wallet | `DELETE /wallets/{id}`, `OWNER` only |
| Complete a goal | `PATCH /goals/{id}` `{ status: 'COMPLETED' }` |
| Cancel a goal | `DELETE /goals/{id}` (sets `CANCELLED`, keeps contributions) |

Auth routes are rate-limited at `AUTH_RATE_LIMIT_PER_MINUTE` (10) per IP per route (`auth-rate-limit.guard.ts`). Four registrations, the phase-1 login check, and at most one refresh per persona per 15-minute access token (on a `401`) stay under that. A 1–3 minute run normally needs no refresh. Other routes have no limit.

### 1.5 Time model

- **Anchor** = `todayIn('Asia/Ho_Chi_Minh')` at run time, not the UTC date: between 17:00Z and
  midnight UTC the two differ. `SEED_ANCHOR=YYYY-MM-DD` overrides it.
- **What the anchor reproduces.** The same `SEED` and `SEED_ANCHOR` give the same data, and the same
  results for `verify.ts`'s reads, which pass `activeOn`/`dateFrom`/`dateTo` explicitly. The server
  and app still read at the real date: the dashboard's default month, the budgets on Planning
  (`activeOn: today`), every create response. So screenshots also need the run date to equal the
  anchor, or the device and server clocks set to it.
- **History** = the 12 full months before the anchor's month, plus the anchor month up to the
  anchor. On the anchor day itself, a `COMPLETED` row can't be later than the run instant (a
  balance has no date filter, so a 21:00 dinner would count before it happened). Later habit rows
  that day are dropped. That cut depends on the run time, so §7 item 8's determinism holds only for
  a `SEED_ANCHOR` before the run date. With an anchor of 2026-10-06 that is 2025-10-01 → 2026-10-06, which covers
  11.11 and Black Friday 2025, Tet 2026 (17 Feb), the Apr–Jun hot season and a summer trip.
- **Future** = a few `PENDING` items up to 30 days ahead (upcoming rent, a booked charge).
- Every wallet is in `Asia/Ho_Chi_Minh`: `POST /auth/register` and `POST /wallets` both require an
  IANA `timeZone` (`timeZoneSchema`; a fixed offset like `+07:00` is a `422`).
- Local times come from realistic windows (breakfast 06:45–08:45, lunch 11:30–13:15, dinner
  18:00–21:30, late-night 22:30–23:59) in the wallet's zone. One month's **Rent** (an EXPENSE, so
  income/expense and the Housing budget see it) is at 00:10 local on the 1st, which is 17:10Z on
  the **last day of the previous month**. One month's last-day **Bank fee** is at 23:30 local
  (16:30Z, same date). The first tests that day grouping and month windows follow the wallet's day,
  not the UTC one (Part 7 rule 18). A transfer wouldn't: it's in neither income nor expense.
- Instants are built with `zonedInstant(day, time, timeZone)` (`calendar.ts`), both a transaction's
  `transactionDate` and a contribution's `contributionDate`. A transaction-backed contribution's
  date becomes its expense's `transaction_date`, so a wrong offset would move it across a month.
- The generator files every row under `dayOfInstant(…, timeZone)` and builds windows with
  `budgetWindow`/`dayRange`, the same `@sora/contracts` calendar the dashboard and budgets read with
  (`dashboard.service.ts`, `budgets.service.ts`), so expected sums use the server's day rule.
- Tet dates come from a table (2025-01-29, 2026-02-17, 2027-02-06), not a fixed month.

### 1.6 Amount realism

- VND amounts round to 1,000 (cafés and markets to 5,000; bills keep exact values like
  `1,284,600`). USD keeps cents. JPY has no minor unit, so whole yen only. The seed enforces
  that itself: the server accepts up to 4 decimals in any currency (`currencySchema` is only
  `/^[A-Z]{3}$/`).
- Amounts are strings end to end (Part 7 rule 1): generate as scaled `bigint` via
  `packages/contracts/src/money.ts`, never JS numbers.
- Distributions: a log-normal around a typical value per merchant, clamped to a range, plus an
  optional rare outlier band. Coffee is 35k–65k, with a 5% chance of 85k–110k (§5.3).
- **No account but the credit card goes below zero.** The generator tracks a running `bigint` balance
  per account and fails loudly if any non-credit account would go negative, instead of emitting it.

---

## 2. Personas and wallets

Four registered users plus one non-user (a pending invitee). The headline feature — tracking
someone else's money with a per-person role — needs each of the patterns below.

| Persona | Who | Base / locale | Wallets they own | Roles elsewhere |
|---|---|---|---|---|
| **An Nguyen** (demo login) | 29, office job in HCMC, freelances in USD on the side | VND / `vi` | **An's Wallet** (from register), **Mom's Wallet** (created by An to track his mother's cash; Mom is not a user), **Shared House 2025** (archived) | `EDITOR` on Linh's Wallet ("Girlfriend") |
| **Linh Tran** | 27, teacher, tutors on weekends | VND / `en` | **Linh's Wallet** | `VIEWER` on An's Wallet ("Boyfriend") |
| **Khoa Pham** | friend; co-rented a weekend house in Vũng Tàu with An (Oct 2025–Mar 2026) | VND / `vi` | **Khoa's Wallet** (sparse) | `EDITOR` on Shared House 2025 — then **revoked** after recording some transactions |
| **Bao Le** | An's brother, student | VND / `vi` | **Bao's Wallet** | `VIEWER` on Mom's Wallet ("Mom") |
| *(not a user)* | An's sister | — | — | Open invitation to Mom's Wallet, `EDITOR`, relation "Mom", sent to `seed+sister-<runId>@example.invalid` — never accepted |

The quoted labels are `relationLabel`s. The wallet's owner sets one on `POST /wallets/{id}/invitations`;
accept copies it and nothing edits it later. The seed uses the invitee's view of the wallet
(`schemas.ts` `inviteMemberSchema`), because that's what the invitee's wallet switcher shows in place
of the wallet name (`WalletSwitcher.tsx`). SRS FR-11 and the invite form's prompt read it as the
inviter's word for the person instead. That contradiction is a product question outside this plan.

Each persona registers with `displayName` = first name only (An, Linh, Khoa, Bao), its `locale` and `timeZone: 'Asia/Ho_Chi_Minh'`. The first wallet's name is built from `displayName` (`starterWalletName`), so a full name would give "Ví của An Nguyen". The locale names its first wallet and Cash account (API spec §5.1), and the seed sends it as `Accept-Language` on its own requests. Mom's Wallet and Shared House 2025 are created with the same `timeZone`. An (`vi`) and Linh (`en`) share wallets, so the same starter categories read in two languages — worth a manual check.

Registration names the `vi` personas' first wallets **"Ví của An"**, **"Ví của Khoa"** and **"Ví của Bao"**, with a Cash account named **"Tiền mặt"**. Linh (`en`) gets **"Linh's Wallet"** and **"Cash"**. The seed keeps these names because they show the sign-up language at work. "An's Wallet", "Khoa's Wallet" and "Bao's Wallet" elsewhere in this plan mean the wallets stored as "Ví của An", "Ví của Khoa" and "Ví của Bao".

What each pattern exercises:

| Pattern | Exercises |
|---|---|
| An owns Mom's Wallet himself | Tracking a non-user's money; cross-wallet transfer between two wallets one person owns |
| An is `EDITOR` on Linh's | Cross-wallet transfer across a person boundary (BR-02, `EDITOR` on both), transactions created by a non-owner |
| Linh is `VIEWER` on An's | Read-only UI; a `403` if she tries to write (not seeded — an E2E/manual check) |
| Khoa revoked | `REVOKED` member row still resolving `created_by_user_id` to a name (BR-01) |
| Open invitation | Pending-invitation list, masked email preview (BR-08) |
| Archived wallet | Read-only history; excluded from the active wallet switcher |

---

## 3. Accounts

All four `ACCOUNT_TYPES`, three currencies, signed opening balances, one archived account.

**An's Wallet**

| Account | Type | Ccy | Opening balance | Role in the story |
|---|---|---|---|---|
| Vietcombank | `BANK_ACCOUNT` | VND | 42,000,000 | Salary in, rent/bills out, hub of transfers. Monthly outflows (≈ 29M, plus 2.5M House Share Oct–Mar) exceed salary until the Tet bonus, and rent and the allowance fall before payday, so it needs this buffer |
| Techcombank Savings | `BANK_ACCOUNT` | VND | 45,000,000 | Monthly savings transfer in, interest income; backs emergency-fund earmarks; sends 30,000,000 back to Vietcombank on 2026-08-01 for Japan prep |
| Tiền mặt (seeded at register) | `CASH` | VND | 0 → funded with 1,200,000 | Street food, markets, wedding envelopes; refilled by ATM withdrawals |
| MoMo | `E_WALLET` | VND | 350,000 | Coffee, Grab, phone top-ups; refilled by top-up transfers |
| VIB Visa | `CREDIT_CARD` | VND | **−2,450,000** | Online shopping, subscriptions; paid off monthly; refunds land here |
| Wise USD | `BANK_ACCOUNT` | USD | 320.50 | Freelance income, USD courses, MacBook goal |
| Japan Cash | `CASH` | JPY | 80,000 | Opened for the trip with exchanged cash; whole-yen amounts |
| ACB (old) | `BANK_ACCOUNT` | VND | 3,180,000 | Balance transferred out in month 2, then **archived** |

**The seeded Cash account always opens at 0.** Registration creates it with `initial_balance: '0'` (`auth.service.ts` `seedWallet`), and `updateAccountSchema` has no `initialBalance`. So the seed funds it on the first history day with a categorized Cash Withdrawal transfer from the main bank account. It doesn't open a second cash account. Verify item 1's expected balances start from 0 plus that transfer.

**Linh's Wallet** — BIDV (bank, VND, 9,800,000), Cash (seeded, funded with 600,000 from BIDV), ZaloPay (e-wallet, VND, 150,000). Cash and ZaloPay follow §5.2's refill rule from BIDV.
**Mom's Wallet** — Mom's Cash (VND, 4,000,000; Pension lands here), Agribank (bank, VND, 120,000,000 — a large figure that exercises compact formatting).
**Shared House 2025** — House Kitty (cash, VND, 0). Each month's contributions are dated before that month's Rent, so the kitty never goes negative. Wallet archived at the end of its story.
**Khoa's / Bao's Wallet** — one bank account each, plus the seeded "Tiền mặt" (left at 0 unless funded), and a handful of transactions; enough to be non-empty.

---

## 4. Categories

Registered wallets start with the 38 starter categories, each carrying a `system_key` so its name follows the reader's locale (API spec §2.11); the seed's own custom categories are stored as typed. **`POST /wallets` does not seed any**
(only `auth.service.ts`'s `seedWallet` does), so Mom's Wallet and Shared House 2025 get their
categories from the seed.

The seed resolves starter categories by `systemKey` (`CategoryResponse.systemKey`, e.g. `housing`),
never by name. A response's name follows the caller's `Accept-Language`, so An's `vi` requests get
"Nhà ở", not "Housing". The English names below are for reading only.

Icons must be keys of `mobile/src/utils/categoryIcons.ts` (37 lucide names: `utensils`, `bus`,
`gift`, `handshake`, `heart-pulse`, …); anything else falls back in the app. The server doesn't
validate icons (`createCategorySchema.icon` is any string up to 50), so the seed must check them itself.
All 38 starters are top-level, so every subcategory below is the seed's own. Names are unique per
`(wallet, parent)` across types (`uq_category_name_per_parent`), and a child must share its
parent's type (`CATEGORY_WRONG_TYPE`).

**Custom categories in An's Wallet**

| Kind | Name | Type | Parent | Icon | Why it's there |
|---|---|---|---|---|---|
| Subcategory | Rent | EXPENSE | Housing | `home` | Largest fixed cost |
| Subcategory | Grab | EXPENSE | Transportation | `bus` | Most frequent expense |
| Subcategory | Fuel | EXPENSE | Transportation | `zap` | Motorbike |
| Subcategory | Coffee | EXPENSE | Dining Out | `coffee` | Daily habit |
| Subcategory | Electronics | EXPENSE | Shopping | `shopping-bag` | 11.11 spikes |
| Top-level custom | Family Support | EXPENSE | — | `heart-pulse` | Medical bills paid for Mom directly |
| Top-level custom | Wedding Gifts | EXPENSE | — | `gift` | Envelopes; seasonal (Oct–Dec, Mar) |
| Top-level custom | Phone & Internet | EXPENSE | — | `zap` | Split out of Utilities by the user |
| Custom income | Lucky Money | INCOME | — | `hand-coins` | Tet lì xì received |
| Top-level custom | Lucky Money Given | EXPENSE | — | `gift` | Tet lì xì handed out. It needs its own name because names are unique per parent across types |
| Custom income | Side Project | INCOME | Freelance | `briefcase` | Income subcategory |
| Custom transfer | Allowance to Mom | TRANSFER | — | `handshake` | Monthly cross-wallet transfer |
| Custom transfer | Settle Up | TRANSFER | — | `handshake` | Paying Linh back |
| Custom transfer | House Share | TRANSFER | — | `home` | An's monthly share into Shared House 2025's House Kitty |
| **Archived** | Gym Membership | EXPENSE | Fitness | `dumbbell` | Used for 5 months, then archived (has transactions, so it can't be hard-deleted) |

**Mom's Wallet** (created from scratch, 12 categories): Market, Medicine, Temple Offering,
Electricity & Water, Gifts for Grandkids, Phone, Other Expense, Pension, Allowance from Children,
Interest, Other Income, Savings (transfer). A transfer's category comes from the paying side's
wallet (`categorisedAccountId`). So the allowance is one transaction carrying An's "Allowance to
Mom", and no Mom-side category can be put on it. Settle Up into Linh's BIDV works the same way.
Mom's "Allowance from Children" is for cash handed over in person (Bao at Tet). An records it
as INCOME, because Bao is only a `VIEWER` there.
**Shared House 2025**: Rent, Utilities, Groceries, Cleaning, Contribution (income), Other.

---

## 5. Transactions

Target volume, from the §5.2–§5.5 rates: An ≈ 1,500 (≈ 120/month: ~96 habit rows plus ~22
recurring and refills), Linh ≈ 550, Mom ≈ 300 (Market ≈ 240 of them), Shared House ≈ 120, Khoa/Bao
≈ 30 each. That's well over the default page size of 25, so pagination and infinite scroll get
exercised on every list.

### 5.1 Coverage matrix — every shape and status

| Kind | Example in the seed |
|---|---|
| INCOME → bank | Salary 28,000,000 on the 25th (the previous Friday when the 25th is a weekend, §5.2) |
| INCOME → savings | Interest ~90,000–110,000 on the 1st |
| INCOME → USD account | Freelance $150–$600, 2–4 a quarter, irregular dates |
| INCOME → credit card | Refund of a returned 11.11 purchase |
| INCOME → cash | Lucky Money at Tet, a birthday Gift |
| INCOME, income subcategory | Side Project |
| EXPENSE, top-level category | Groceries at Co.opmart |
| EXPENSE, subcategory | Grab, Coffee, Rent |
| EXPENSE, each account type | bank (rent), cash (phở), e-wallet (Grab), credit card (Netflix), USD (online course), JPY (the ryokan balance due on arrival, ¥35,000: a `PENDING` expense from Japan Cash dated on the arrival day, the Japan goal's target date, because the trip is after the anchor) |
| EXPENSE tagged with a goal | Japan flights, JR pass → feeds the goal budget |
| TRANSFER **cross-wallet into a shared wallet** | House Share: An's Vietcombank → House Kitty, monthly Oct 2025–Mar 2026 |
| EXPENSE in an archived category | Gym, dated before the archive |
| TRANSFER same wallet, categorized | Cash Withdrawal, Top Up, Credit Card Payment, Savings |
| TRANSFER same wallet, **uncategorized** | Occasional move between Vietcombank and MoMo (`categoryId: null`) |
| TRANSFER **cross-wallet, same owner** | Allowance to Mom: An's Vietcombank → Mom's Cash, 3,000,000 on the 5th |
| TRANSFER **cross-wallet, across people** | Settle Up: An's Vietcombank → Linh's BIDV after shared trips |
| TRANSFER closing an account | ACB (old) → Vietcombank for the full balance, then archive ACB |
| Status `PENDING` | Next month's rent (future-dated); the Japan hotel hold (§5.4); the ryokan balance |
| Status `DELETED` | Duplicates "entered twice", deleted via `POST /transactions/{id}/delete` |
| Edited (`PATCH`) | Amount typo corrected; EXPENSE → TRANSFER (a "payment" that was really a card payoff); category changed; date moved |
| Created by a non-owner | An's entries in Linh's Wallet; Khoa's in Shared House 2025 |
| With `reference` | Bank transfers carry `FT26xxxxxxxx`-style refs |
| Without description | ~25% of habit spending has none — real users skip it |
| Bilingual descriptions | "Phở Hòa Pasteur", "Highlands Coffee", "Grab đi làm", "Netflix", "Tiền điện tháng 5" |

**Not seeded, on purpose:** cross-currency transfers (rejected, `TRANSFER_CURRENCY_MISMATCH`, out of
scope for v1, BR-07), and a goal tag on income or transfers (`chk_transaction_goal`).

### 5.2 Recurring rules (An)

| Rule | Schedule | Amount | Account → category |
|---|---|---|---|
| Salary | 25th, weekend → previous Friday | 28,000,000 | → Vietcombank / Salary |
| Tet bonus | 10 days before Tet, weekend → previous Friday (2026-02-06) | 28,000,000 | → Vietcombank / Bonus |
| Rent | 1st | 6,500,000 | Vietcombank / Rent (+ a `PENDING` one for next month) |
| Electricity | 8th–12th | 650k–1.6M, higher Apr–Jun | Vietcombank / Utilities |
| Water | 10th–14th | 90k–160k | Vietcombank / Utilities |
| Internet | 15th | 220,000 | Vietcombank / Phone & Internet |
| Phone top-up | ~20th | 100,000 or 200,000 | MoMo / Phone & Internet |
| Netflix / Spotify / iCloud | fixed days | 260,000 / 59,000 / 45,000 | VIB Visa / Subscriptions |
| Gym | 3rd, months 1–5 only | 500,000 | VIB Visa / Gym Membership |
| Card payoff | 27th, after salary | the statement total so far, rounded | Vietcombank → VIB Visa / Credit Card Payment |
| Savings | day after salary | 5,000,000 (3,000,000 in Tet month) | Vietcombank → Techcombank / Savings |
| Allowance to Mom | 5th | 3,000,000 | Vietcombank → Mom's Cash / Allowance to Mom |
| ATM withdrawal | before a cash spend that would leave Cash < 300k | `max(1,000,000, amount + 300,000)`, rounded up to 100k | Vietcombank → Cash / Cash Withdrawal |
| MoMo top-up | before a MoMo spend that would leave MoMo < 100k | `max(300,000, amount + 100,000)`, rounded up to 100k | Vietcombank → MoMo / Top Up |
| House Share | 1st, Oct 2025–Mar 2026 | 2,500,000 | Vietcombank → House Kitty / House Share |
| Bank fee | last day of month | 11,000 | Vietcombank / Fees |
| Interest | 1st | 90k–110k | → Techcombank / Interest |

The refill rules check **before** each spend and emit the refill earlier the same day. Checking after
the spend can't cover one large payment (a 1.2M wedding envelope from 400k of cash). This needs the
running `bigint` balance per account from §1.6, emitted in date order.

### 5.3 Habits (An)

| Habit | Days | Probability | Window | Amount | Account / category |
|---|---|---|---|---|---|
| Coffee | weekdays | 0.7 | 07:30–09:30 | 35k–65k; 5% of cups 85k–110k | MoMo / Coffee |
| Breakfast | weekdays | 0.6 | 06:45–08:30 | 25k–50k | Cash / Food |
| Lunch | weekdays | 0.85 | 11:30–13:15 | 40k–90k | Cash or MoMo / Food |
| Grab | weekdays | 0.5, ×2 | commute times | 25k–75k | MoMo / Grab |
| Fuel | every ~9 days | — | any | 70k–110k | Cash / Fuel |
| Groceries | Sat or Sun | 0.9 | 09:00–11:30 | 300k–900k | Vietcombank / Groceries |
| Dining out | Fri–Sun | 0.45 | 18:30–21:30 | 150k–550k | VIB Visa / Dining Out |
| Snacks / drinks | any | 0.3 | 15:00–17:00, 22:30–23:59 | 15k–45k | Cash / Snacks or Drinks |
| Online shopping | any | 0.08 | evenings | 150k–1.2M | VIB Visa / Shopping |
| Cat food | every ~3 weeks | — | — | 250k–420k | VIB Visa / Pets |

### 5.4 Events (one-off clusters)

| Event | When (anchor 2026-10-06) | What |
|---|---|---|
| ACB closure | Nov 2025 | Transfer out the full balance, archive the account |
| 11.11 / Black Friday / 12.12 | Nov–Dec 2025 | Fixed spike on VIB Visa, about 6,000,000: Electronics 2,490,000, 1,290,000 and 690,000; Shopping 450,000; a 1,200,000 Shopping item returned and refunded 2 weeks later (the refund is INCOME, so it doesn't lower the 11.11 budget's `spent`) |
| Wedding season | Oct–Dec 2025, Mar 2026 | 4–6 Wedding Gifts in cash, 500k–2M |
| Tet 2026 | Feb 2026 | Bonus in; Lucky Money in and out; gifts, Groceries ×3, travel home (bus tickets); Tet food from Cash, 4–6 entries of 400k–800k (≈ 2.4M), so Food reaches ≈ 125%. The whole cluster is ≥ 12M of expenses, so Monthly Cap is over too |
| Mom's hospital visit | Apr 2026 | Family Support 4,800,000 from Vietcombank; Medicine in Mom's Wallet |
| Hot season | Apr–Jun 2026 | Electricity bills peak |
| Da Lat trip with Linh | Jun 2026 | An pays the coach tickets and his own meals (An's Wallet / Travel ≈ 4M); Linh pays the homestay from BIDV. Settle Up, An → Linh, covers An's half of the homestay |
| Japan hotel hold | anchor − 2 days | A 3,000,000 VND pre-authorization on VIB Visa / Travel, `PENDING` and never settled |
| Motorbike service | Aug 2026 | Repairs & Maintenance 1,350,000 |
| Japan trip prep | Aug–Oct 2026 | Techcombank → Vietcombank 30,000,000 (Savings) on 2026-08-01. Flights 12,800,000 and a JR pass 8,700,000, both VND on VIB Visa / Travel, tagged with the Japan goal. The yen bought shows as an untagged VND Travel expense "Currency exchange" of 13,900,000 for ¥80,000, plus Japan Cash's opening balance — no cross-currency transfer exists (BR-07) |

### 5.5 Other wallets

- **Linh's Wallet** — salary on the 5th (14,500,000), tutoring income (Part Time) on weekends,
  her own habits at about 0.3× An's frequency (≈ 6–7 rows and ≈ 870k a week), Settle Up received from An, and a few of Linh's own
  expenses logged by An ("groceries An logged for Linh"). A Linh-wallet expense must be paid from a
  Linh account, so a dinner An paid for belongs in An's wallet and only lowers what An owes at the
  next Settle Up. Settle Up always runs An → Linh: Linh is only `VIEWER` on An's Wallet, so she
  can't move money into it (BR-02).
- **Categories are per wallet.** A transaction's category must belong to the wallet of the account
  it's categorised by (`CATEGORY_WRONG_WALLET`), so the generator keeps one category map per wallet.
  An's entries in Linh's Wallet use Linh's starter categories; his Shared House entries use §4's
  Shared House set.
- **Mom's Wallet** — Pension 3,500,000 into Mom's Cash on the 10th, Allowance from An (as the
  transfer in), Market from Mom's Cash on 65% of days at 60k–220k (≈ 2.8M a month, ≈ 240 rows), Temple Offering on the 1st and 15th of the lunar month
  (approximated from a short date table), Medicine monthly, a large Agribank term deposit.
- **Shared House 2025** — the Vũng Tàu weekend house, Oct 2025–Mar 2026, separate from An's own
  rent. An's share arrives as a cross-wallet House Share transfer from Vietcombank, early each
  month. Khoa hands over cash, which he records as Contribution income. Both record the shared
  Rent/Utilities/Groceries expenses after that. Khoa is revoked in Apr, then the wallet is archived.

### 5.6 Corrections pass (after all other writes, before the §1.4 state changes)

About 2% of transactions get a realistic mistake and its fix. Rules for the pass:

- Each edit or delete is made by a persona holding `EDITOR` on every wallet the row names
  (`requireAccountsWritable`): An for rows in An's, Mom's, Linh's and Shared House; each owner for
  their own wallet. A non-member's token gets `404`, and a `VIEWER`'s gets `403`.
- The pool excludes goal-tagged expenses and transactions backing a contribution. A money-moving edit
  rewrites the contribution's amount, a date edit leaves the contribution's date behind, and a type
  change refuses a backing row and drops a goal tag (`mergeTransactionUpdate`).
- If `client.ts` sends `Idempotency-Key`, every create gets its own key, the deliberate duplicate
  included. A reused key returns the first response and creates nothing (`idempotency.interceptor.ts`).

1. **Duplicate then delete** — the same Grab ride posted twice within a minute; the second is deleted.
2. **Amount typo** — 450,000 entered as 4,500,000, `PATCH`ed back the same day.
3. **Wrong type** — a "Visa payment" paid from Vietcombank and recorded as an EXPENSE, `PATCH`ed with
   `{ type: 'TRANSFER', toAccountId: <VIB Visa>, categoryId: <Credit Card Payment> }`. A stored
   expense has no `toAccountId`, and an EXPENSE category can't stay on a transfer; the edit is
   re-checked as a create (BR-03, `CATEGORY_WRONG_TYPE`).
4. **Wrong category** — Dining Out → Groceries.
5. **Wrong date** — moved one day back (crosses a month boundary once, which moves the figure
   between two months' budgets).

---

## 6. Goals and budgets

### 6.1 Goals — every status and progress shape

Contributions need the goal `ACTIVE` (`GOAL_NOT_ACTIVE`), so a goal that ends `COMPLETED` or
`CANCELLED` gets its contributions first and its status change last. `COMPLETED` is set only by
`PATCH` — nothing completes a goal automatically.

| Wallet | Goal | Target | Ccy | Target date | End state | Funding |
|---|---|---|---|---|---|---|
| An | Emergency Fund | 60,000,000 | VND | none | ACTIVE, ~55% | Monthly **earmarks** (`recordAsTransaction: false`) from Techcombank — money already sits there |
| An | Japan Trip | 45,000,000 | VND | anchor + 3 weeks, the arrival day (inside §1.5's 30-day future limit) | ACTIVE, ~70% | Earmarks from Techcombank; trip spending tagged with the goal feeds its GOAL budget |
| An | MacBook Pro | 1,999.00 | USD | anchor + 1 month | ACTIVE, ~30% close to its date | Earmarks from Wise USD |
| An | New Motorbike | 35,000,000 | VND | 4 months ago | **COMPLETED**, over-funded: `currentAmount` 35,700,000 = 102% of target, `progressPercentage` reads 100 (`calculateGoalProgress` caps it) | All from Techcombank: earmarks 5 × 4,000,000 (Nov 2025–Mar 2026); transaction-backed (`recordAsTransaction: true`, `categoryId` Transportation) 6,000,000 in Apr 2026 and a final 9,700,000 on 2026-05-30; one more transaction-backed 2,000,000, later removed (below) |
| An | Learn Guitar | 8,000,000 | VND | none | **CANCELLED** at 20% | Two earmarks from Techcombank, kept after cancel (§13.5) |
| An | Wedding Fund | 150,000,000 | VND | anchor + 2 years | ACTIVE, **0%**; created last in phase 2, so it lists first (`GET /goals` sorts by `createdAt` descending, and every `createdAt` is run time, §8) | None — empty state |
| An | Laptop Repair | 5,000,000 | VND | 1 month ago | ACTIVE, **overdue** at 80% | Earmarks from Techcombank |
| Linh | Anniversary Trip | 20,000,000 | VND | anchor + 3 months | ACTIVE, ~40% | Earmarks on BIDV by Linh and by **An** (An is EDITOR). A contribution's account must be in the goal's wallet, so An can't contribute from his own accounts (`403`) |
| Mom | Health Check-up | 6,000,000 | VND | anchor + 1 month | ACTIVE, ~65% | Transaction-backed from Mom's Cash, `categoryId` Medicine |

A transaction-backed contribution must name an EXPENSE category in the goal's wallet
(`goal-contributions.service.ts`: "Required when recording as a transaction"). It creates a
`COMPLETED`, goal-tagged EXPENSE, which moves the account balance and counts in dashboard `expense`
and in wallet-wide budgets (Monthly Cap, Mom's Daily Spending).

An earmark moves no money, and the server doesn't check it against a balance (only role, wallet
and currency). The plan keeps earmarks plausible: until 2026-08-01, Techcombank's running balance
(≈ 78M by July: 45M opening + ≈ 48M savings + ≈ 1M interest − 15.7M Motorbike payments) stays above
its active earmarks (≈ 60M: Emergency ≈ 27.5M, Japan ≈ 26M, Laptop 4M; Motorbike's and Learn Guitar's are released
when they're completed or cancelled). Then the 30,000,000 Japan transfer leaves the Japan earmarks
pointing at money that has been spent, as a real user's stale earmark would. The generator checks the
"until 2026-08-01" part.

"Overdue" has no API field: it's `status = ACTIVE` with `targetDate` before the anchor, computed by
`verify.ts`. The API reports no pace either, so "close to its date" is narrative only.

Also: one transaction-backed contribution on Motorbike is **removed** (`DELETE /goals/{id}/contributions/{contributionId}`).
That deletes the contribution row outright and flips its backing transaction to `DELETED`. The
`DELETED` transaction (still goal-tagged) and the `GOAL_CONTRIBUTION_REMOVED` audit entry remain;
`GET /goals/{id}/contributions` no longer lists it.

### 6.2 Budgets — every kind, every period, every state

`spent` counts only `COMPLETED` `EXPENSE` transactions in the budget's currency (§12.2), and only one
budget per target over overlapping days (the `excl_budget_*_overlap` constraints). Monthly and daily
budgets start at the history start (2025-10-01), except Bills (2025-10-31, to exercise a 31st start).
Weekly ones start on the first Monday, 2025-10-06. Yearly ones start on 2026-01-01.

The last column is the typical period, then the reading at the anchor where it differs. A reading
at the anchor (Tuesday 2026-10-06) sees only two days of the current week and none of October's
bills, so `verify.ts` reads the weekly budgets with `activeOn` = the last Sunday on or before the
anchor (2026-10-04, window 09-28 → 10-04). WEEKLY windows follow the start date's weekday, not ISO
weeks (`budgetWindow`).

| Wallet | Budget | Kind | Period | Window | Amount | Typical period / at anchor |
|---|---|---|---|---|---|---|
| An | Food | Category (Food) | MONTHLY | from 2025-10-01 | 3,000,000 | Under, 42–65%; **over** in Feb 2026 (≈ 125%, Tet food) |
| An | Weekend Dining | Category (Dining Out) | WEEKLY | from 2025-10-06 | 700,000 | Near on average (≈ 470k dining out plus ≈ 175k Coffee, a subcategory: ≈ 90%); single weeks swing both ways |
| An | Coffee | Category (Coffee, a subcategory) | DAILY | from 2025-10-01 | 60,000 | Over on 60–65k days and on the 5% outlier cups; weekends 0 |
| An | Bills | Category (Utilities) | MONTHLY | **from 2025-10-31** | 1,500,000 | Starts on the 31st → exercises "a shorter month's last day"; over in Apr–Jun. 0 while the anchor is before that window's first bill (2026-10-06: window 09-30 → 10-30, no bill until the 8th) |
| An | Housing | Category (Housing, parent of Rent) | MONTHLY | from 2025-10-01 | 7,000,000 | ~93%, reached only through the Rent subcategory |
| An | Travel 2026 | Category (Travel) | YEARLY | from 2026-01-01 | 65,000,000 | ≈ 61%: flights 12.8M + JR pass 8.7M + currency exchange 13.9M + An's Da Lat share ≈ 4M |
| An | Online Courses | Category (Education) | YEARLY | from 2026-01-01 | 300.00 **USD** | ≈ 46% from two Wise USD courses: $49 on 2026-03-14 and $89 on 2026-07-09. Counts only USD expenses; VND Education spending doesn't count |
| An | 11.11 Sale | Category (Shopping) | CUSTOM | 2025-11-01 → 2025-12-15 | 6,000,000 | Past, **over** (≈ 142%: the fixed 6,120,000 spike of §5.4 is over on its own, since `isOverBudget` is `spent > amount`; the online-shopping habit adds ≈ 2.4M) |
| An | Wedding Season | Category (Wedding Gifts) | CUSTOM | anchor + 3 weeks → anchor + 3 months | 6,000,000 | **Future**, 0 spent |
| An | Japan Trip | Goal (Japan Trip) | GOAL | 2026-08-01 → the goal's target date | 30,000,000 | ≈ 72% from tagged expenses (flights 12.8M + JR pass 8.7M; the currency exchange is untagged). Not "from goal created": `createdAt` is run time, so the window would miss the Aug–Oct tagged spending. Nothing ties the window to the goal's dates |
| An | Monthly Cap | Wallet-wide | MONTHLY | from 2025-10-01 | 28,000,000 | Under in normal months (≈ 17–26M); **over** in Feb (Tet), Apr–May (Motorbike payments) and Aug–Sep (Japan prep) |
| Linh | Groceries | Category | MONTHLY | from 2025-10-01 | 2,000,000 | Under |
| Linh | Everything | Wallet-wide | WEEKLY | from 2025-10-06 | 1,000,000 | Near (≈ 870k a week at 0.3× An's habits) |
| Mom | Market | Category (Market) | MONTHLY | from 2025-10-01 | 4,500,000 | Under (≈ 2.8M) |
| Mom | Daily Spending | Wallet-wide | DAILY | from 2025-10-01 | 200,000 | Mixed: over on Market days above 200k and on Temple, Medicine or contribution days |

Budgets are created **after** their transactions, matching how they're often set up in reality. A
create response reads `spent` at the server's real date (there's no `activeOn` on create), so a
repeating budget can rightly read 0 there. §12.2's "`spent` is computed immediately, not zero" is
asserted only on the fixed-window ones, 11.11 Sale and Japan Trip.

A category budget counts its subcategories at any depth (API spec §12.2). So Weekend Dining (Dining
Out) also counts Coffee. Food has no subcategory in this plan, so the Food budget counts only Food.
Verify item 4 needs one parent budget whose `spent` comes only through a subcategory. That's the
Housing row: its only transactions are Rent (6,500,000 / 7,000,000 ≈ 93%; next month's `PENDING`
rent doesn't count). Transportation doesn't qualify, because the Motorbike goal's final payment is
booked straight to it (§6.1).

---

## 7. Verification (`verify.ts`, runs after seeding)

Read back through the API and fail loudly on any mismatch. Each wallet is read with a current member's
token: An for An's, Mom's, Linh's and Shared House; Khoa and Bao for their own. A non-member gets
`404`, and Khoa loses Shared House at the revoke.

1. **Balances** — for every account, `GET /accounts/{id}` balance equals the generator's running
   `bigint` balance (opening balance + completed inflows − completed outflows). A mismatch is either a
   generator bug or a BR-05 regression. The generator's ledger includes the expenses created by
   transaction-backed contributions (§6.1), and drops the removed Motorbike one.
2. **BR-06** — for An's wallet and each month, dashboard `income`/`expense` equal the generator's
   income/expense sums excluding transfers, contribution-backed expenses included.
   `transferredIn`/`transferredOut` equal the **cross-wallet** transfer sums only: a transfer between
   two of the wallet's own accounts appears in neither (`transferDirection`, `responses.ts`). For An
   that leaves Allowance to Mom, Settle Up and House Share, all `transferredOut`. Every figure counts `COMPLETED` rows only.
   Months are wallet-zone months, and the response's `period.timeZone` must read `Asia/Ho_Chi_Minh`.
   The 00:10-on-the-1st entry (§1.5) must count in its local month, not the previous one.
3. **Per-currency totals** (BR-07) — never summed across currencies, per field: `totalBalance` has
   VND, USD and JPY (Japan Cash); `income`/`expense` have VND, plus USD only in months with freelance
   income or a course, and never JPY (the only JPY expense is `PENDING`). `spendingByCategory` covers
   only the month's dominant currency (`dashboard.service.ts`), so USD course spending never shows there.
4. **Coverage** — at least one row for every cell of §5.1 and every row of §6.1/§6.2; counts per
   `type × status`, per account type, per period type and per budget kind printed as a table.
5. **Budget states** — at least one under, one near (80–100%), one over, one zero-spent and one future
   budget at the anchor. The server reads budgets at its own today unless told otherwise, so read
   repeating budgets with `GET /budgets?walletId=…&activeOn=<anchor>` (weekly ones with the last
   Sunday on or before it, §6.2). `activeOn` also drops budgets that don't cover the anchor, so read
   the past and future CUSTOM ones from the unfiltered list. The zero-spent reading is Coffee (DAILY)
   at `activeOn` = the last Saturday on or before the anchor: coffee is a weekday habit, and the
   corrections pass moves a date only one day back, so no coffee row can land on a Saturday.
6. **Goal states** — at least one each of: 0%, partly funded, overdue (computed against the anchor,
   §6.1), over-funded (`currentAmount > targetAmount`; `progressPercentage` caps at 100), COMPLETED,
   CANCELLED.
7. **Roles** — Linh's `GET /wallets` includes An's Wallet with role `VIEWER`.
   `GET /wallets/{id}/members?status=REVOKED` on Shared House lists Khoa; the members list filters
   by status. His transactions there still show his name.
   Shared House is archived, so it's read with `GET /wallets?status=ARCHIVED`.
8. **Determinism** — two runs with the same `SEED` and `SEED_ANCHOR` against two fresh databases produce
   identical coverage tables and balances (CI-able later; manual for now).

Then a manual pass in the app per `docs/DESIGN_GUIDELINES.md` Part 4: dashboard, the month/day
lists across a midnight edge, the budget states, the active goals' states, an archived
account/category/wallet, the VIEWER view as Linh, a cross-wallet transfer showing in both wallets.
What the app can't show is checked through the API only (items 5–6):

- Planning lists only `ACTIVE` goals, and so does the dashboard, so COMPLETED and CANCELLED goals
  appear nowhere in the app. The app has no overdue state; a goal card shows only its target date.
- Planning lists budgets active today. The past 11.11 Sale and the future Wedding Season are
  reachable only through the dashboard's view of their month.

---

## 8. Known limitations

- **`created_at` is "now"** for every seeded row, even when `transactionDate` is a year ago. Lists
  sort by `transactionDate`, so this mostly doesn't show; any "member since"/"created on" label will
  read "today". The audit log is the same: it filters on `created_at`, so the OWNER audit log shows
  every seeded event (≈ 3,000) on the run day.
  If that matters for demos, a separate opt-in script can backdate `created_at` with
  `UPDATE … WHERE id IN (<exact ids from .seed/<runId>.json>)` — never by date range or prefix. It
  runs only when asked, takes `DATABASE_URL` explicitly (the seed itself has no database
  connection), prints the database name and asks for confirmation, and refuses a name outside
  `dev|test|local|check|scratch|ci`, like `migrate.mjs --reset` (Data Safety).
- **Goals and budgets are created at run time** but their windows and contributions are backdated,
  so a goal can show contributions older than its own `createdAt`. Same remedy as above.
- **Guest mode** (device-local store) is not covered — it seeds from `STARTER_CATEGORIES` on its own.
  A guest-mode fixture would be a separate, mobile-side task.
- **AI conversations** are left out of v1. Optional phase: through `POST /ai/conversations` and the
  deterministic stand-in model, one confirmed draft, one dismissed, one pending.
- **Exchange-rate snapshots** are not seeded; the dashboard's converted total shows whatever the live
  or cached provider returns.

---

## 9. Open questions — check before building

| # | Question | How to check |
|---|---|---|
| 1 | ~~Does the server accept a future `transactionDate` for `PENDING` rows?~~ **Resolved:** `createTransactionSchema` takes `status` (default `COMPLETED`), `transactionDate` is only `isoDateTimeSchema`, and nothing rejects a future date | Phase 1's first run confirms it |
| 2 | ~~Does `POST /budgets` accept a future `startDate`?~~ **Resolved:** the only date rule is `endDate >= startDate` | Same |
| 3 | Does the mobile category picker render nested subcategories well (one level)? Deeper nesting is allowed server-side but not planned here | Open the picker on seeded data |
| 4 | Should the seed run in CI (determinism check, item 8 of §7)? | Adds ~2 min to a job; decide after v1 |

---

## 10. Phases

| Phase | Delivers | Done when |
|---|---|---|
| 1 | `client.ts`, `rng.ts`, `calendar.ts`, guard, `.env.seed` and `.seed/<runId>.json` output (`.seed/` added to `.gitignore`), `scripts/seed/tsconfig.json` in the root `typecheck`; register all 4 personas first (an invitee accepts with their own token, and their email must match: `INVITATION_EMAIL_MISMATCH`); An creates Mom's Wallet and Shared House 2025; owners invite (An: Linh → An's Wallet `VIEWER`, Bao → Mom's `VIEWER`, Khoa → Shared House `EDITOR`, the sister → Mom's `EDITOR`, left open; Linh: An → Linh's Wallet `EDITOR`); each invitee accepts | A run creates the users; login works with `.env.seed` credentials |
| 2 | Accounts and custom categories (§3, §4), all active for now; the goals of §6.1 created `ACTIVE` with no contributions, because a goal-tagged expense needs its goal to exist (`requireGoalInWallet`) | `GET /accounts`, `GET /categories`, `GET /goals` match §3/§4/§6.1 |
| 3 | The generators build the **whole ledger in memory first**: all of §5.2–§5.5 plus the contribution-backed expenses of §6.1, merged in date order across wallets. That's where refills, the non-negative check (§1.6) and the earmark check (§6.1) run, since a phase-4 event (a wedding envelope) or a phase-5 contribution moves the same balances. Phase 3 posts An's recurring and habit rows from it | Verify item 1 passes for An, against the rows posted so far |
| 4 | Post events, other wallets and cross-wallet transfers from the same ledger | Verify items 1–3 pass for all wallets, against the rows posted so far |
| 5 | Contributions (including the Motorbike removal); budgets. Goal status changes wait for phase 6 | Verify items 1 and 5 pass |
| 6 | Corrections pass, then the state changes of §1.4 (complete Motorbike, cancel Learn Guitar, archive ACB and Gym, revoke Khoa, archive Shared House last); full `verify.ts`; coverage table | All of §7 passes on a fresh database |
| 7 | README/RUNBOOK entry (`npm run db:seed`, run against a scratch database per §1.3); CLAUDE.md's Project Structure (`scripts/seed/`) and Dev Commands, with the `AGENTS.md`/`.agents/rules/` ports; this plan's status and its `plans/README.md` row → Implemented | Docs updated; `npm run agents:check` passes |
