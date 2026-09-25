# Sora

A mobile finance tracker for **your money and the money of the people you share it with**.

Most finance apps model one person. This one models a **Wallet** — one person's finances — and
lets another real user hold a role on it. That is the point of the product: you can watch your
partner's spending because she gave you access, record paying her back as one real transfer, and
still see your own budget untouched by it.

- **Wallet** — one person's finances. "Tam's Wallet", "Linh's Wallet", "Mom's Wallet".
- **Account** — where that person's money sits: Vietcombank VND, Cash, MoMo, a Visa card.
- **Member** — another real user holding `OWNER`, `EDITOR` or `VIEWER` on a wallet, labelled by
  relationship ("Girlfriend", "Mom").
- **Transaction** — `INCOME`, `EXPENSE` or `TRANSFER`, hanging off *accounts*.

The wallet is the sharing boundary. There is no container above it and no wallet "type".

## The sharing model, concretely

Tam and Linh each own a wallet. Linh invites Tam to hers as `EDITOR`, labelled "Girlfriend":

```text
Tam's Wallet                          Linh's Wallet
  owner: Tam                            owner: Linh
  members: Tam (OWNER)                  members: Linh (OWNER)
                                                 Tam  (EDITOR, "Girlfriend")
  Accounts                              Accounts
    Vietcombank VND                       Techcombank VND
    Cash
  Budget: Food 3,000,000 VND/mo
  Goal:   New Laptop 30,000,000 VND
```

Tam owes Linh 500,000 and pays her back. That is **one** transaction, not two:

```text
TRANSFER  Tam's Vietcombank ──500,000──▶ Linh's Techcombank
          created_by: Tam
          permitted because Tam holds EDITOR on both wallets
```

Three things follow, and they are the whole design:

1. **A cross-wallet transfer needs `EDITOR` on both wallets.** Stricter than a same-wallet
   transfer on purpose — it moves money across a person boundary, so read access to someone's
   wallet must not let you push money into it.
2. **A transfer is not spending.** It never touches Tam's Food budget, his expense total, or his
   spending-by-category breakdown. Money moved is not money spent, and an app that says
   otherwise makes every other figure untrustworthy.
3. **Every balance is derived.** Nothing stores a running total. Balances, budget `spent` and
   goal progress are computed from the transactions on every read, so there is no cached number
   that can drift away from the ledger.

Tam also sees Linh's wallet in his wallet list, with his role and relationship label on it. Linh
sees exactly who can see her money. Removing him is one revoke, and his past entries keep his
name on them rather than becoming anonymous.

## Repository layout

One npm monorepo; the root `package.json` links the packages below as siblings, so
`@sora/contracts` resolves from source with no publish or build-copy step.

```text
packages/contracts/   @sora/contracts — enums, Zod schemas, response types,
                      error codes, route paths, and all money/derivation math.
                      Imported by both sides; redefined by neither.
server/               NestJS 11 + Kysely + pg. TypeScript ESM.
mobile/               Expo + React Native, React Navigation, Redux Toolkit + RTK Query.
                      mobile/e2e/ holds the Maestro journeys.
db/migrations/        Raw SQL, forward-only, immutable once applied.
db/tests/             psql probes proving the constraints reject what they should.
docs/API_SPECIFICATION.md   The authoritative 52-endpoint contract.
scripts/check-contract-parity.mjs   Proves contract ↔ schema ↔ spec agreement.
.github/workflows/ci.yml    Contracts → database → server; contracts → mobile; then e2e.
```

Design and requirements: [`SRS.md`](SRS.md) (what the system does and why), [`SDS.md`](SDS.md)
(how it's designed — stack, architecture, screens, feature-to-implementation mapping),
[`plans/architecture/domain-database-design.md`](plans/architecture/domain-database-design.md) (domain
and schema rationale). Conventions and rules: [`CLAUDE.md`](CLAUDE.md).

## Setup

Requirements: **Node 22+**, **PostgreSQL 17** running locally. No container runtime is required —
see [Docker](#docker) for the optional containerized `server/` + Postgres path.

Already have Postgres running and `.env` filled in? `npm run setup` does steps 1, 4 and 5 below
in one shot (install, migrate, build the contract). Otherwise follow the steps in order.

**1. Install.**

```bash
npm install
```

**2. Create the database and a role for it.** Adjust names to taste; whatever you pick goes into
`DATABASE_URL` below.

```bash
sudo -u postgres createuser --pwprompt sora
sudo -u postgres createdb --owner=sora sora_db
```

**3. Configure.**

```bash
cp .env.example .env
```

Fill in at minimum `DATABASE_URL` and `JWT_SECRET` (`openssl rand -base64 48`).
`server/src/config/env.ts` validates the whole environment once at boot and the process refuses to
start on anything missing or unusable — a secret that reads as configured but is 8 characters
authenticates nothing while looking fine, so that failure has to be loud and early rather than
a degraded request path. It is also the authoritative list of variable names and defaults; where
`.env.example` and `env.ts` disagree, `env.ts` is what actually gets read.

**4. Apply the schema.**

```bash
npm run db:migrate                    # applies db/migrations/*.sql in order
npm run db:test                       # applies them, then runs db/tests/*.sql
```

The runner records a checksum per file in `schema_migrations` and commits each file together with
its bookkeeping row, so a failed file leaves nothing half-applied. Don't apply files by hand with
`psql -f`: the database would then disagree with `schema_migrations`.

The first migration creates the `pgcrypto` and `btree_gist` extensions itself, so the role needs
permission to — grant it, or run the file once as a superuser.

**5. Build the shared contract**, which both the API and the app typecheck against:

```bash
npm run build -w @sora/contracts
```

**6. Run the API (backend).**

```bash
npm run dev:server                 # build, then watch + auto-restart on every change
npm run build -w @sora/server && npm start -w @sora/server   # one-shot, no watch
```

`GET /api/v1/health` answers `{ "status": "ok", "version": ..., "database": "up" }` and is the
one endpoint deliberately outside the response envelope, so an uptime probe needs no JSON
parsing beyond the status code.

**7. Run the app (mobile — there is no separate web frontend; see [Docker](#docker) for why
`webpage/` doesn't count).**

```bash
npm run dev:mobile                 # or: npm start -w @sora/mobile / cd mobile && npx expo start
npm run dev:mobile:clear           # same, with Metro's cache cleared — use when the bundle serves stale code
```

Set `EXPO_PUBLIC_API_URL` to a host **the device** can reach. On a physical phone `localhost`
resolves to the phone itself, so it must be your machine's LAN address; the API's
`CORS_ORIGINS` needs to allow the Expo dev origin in return.

**Both at once**, from the repo root:

```bash
npm run dev                        # server (watch) + Expo dev server together
```

## Tests and checks

```bash
npm test                            # every package with a test script
npm test -w @sora/contracts      # money and derivation math (node --test)
npm test -w @sora/server         # every declared route is actually mounted
npm run typecheck                   # every package
node scripts/check-contract-parity.mjs
```

**The parity check is the one to run after touching any enum, route, or constraint.** It reads
the migration as text — no database, no services, CI-safe — and asserts three things that would
otherwise drift silently and surface as a `500` from Postgres rather than a validation error:

- every enum tuple in `contracts/src/enums.ts` matches the `CHECK` constraint that admits it, in
  both directions (a value the app can send that the database rejects, *and* a legal database
  state the app can never produce);
- every path in `routes.ts` is documented in `docs/API_SPECIFICATION.md`;
- every `ERROR_CODE` has an `ERROR_STATUS` and vice versa.

Against a database with the schema applied, the constraint probes prove the rules actually
reject what the business rules say they reject — the single-owner index, the transaction shape
`CHECK`, the budget overlap exclusion:

```bash
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f db/tests/001_constraints.sql
```

These live in the database because the API will not be the only writer, and a rule enforced
only in a service layer is one import script away from being bypassed.

CI runs the same things: contracts first and alone (every other job depends on it, so a break
there reports as one failure rather than a cascade), then the migrations against a real
PostgreSQL 17 — applied, probed, then **applied again** to prove they are idempotent — then the
API and the app in parallel, and finally the Maestro journeys on an Android emulator against a
release build and a real API (`mobile/e2e/README.md`).

## Money

**Monetary values are JSON strings, never numbers** — `"150000.0000"`, not `150000`. The columns
are `DECIMAL(19,4)`, whose range exceeds the `2^53` boundary where float64 stops representing
integers exactly, and float arithmetic cannot represent `0.1 + 0.2` either. Both failures
produce a balance wrong by an amount nobody can trace back to a cause.

Parse with `parseMoney()` from `@sora/contracts` (scaled `bigint`), render with
`formatMoney()`. Never `Number()`. Amounts are always positive; direction comes from the
transaction `type` and from which account side is populated. `initialBalance` is the one signed
amount — a credit card opens negative.

## Docker

The documented workflow above (host PostgreSQL 17 + npm) remains the primary, always-available
path — see CLAUDE.md's Part 7, rule 10. `docker-compose.yml` and `server/Dockerfile` at the repo
root are an **optional** addition covering only `server/` and Postgres:

```bash
cp .env.example .env   # fill in JWT_SECRET and GOOGLE_CLIENT_ID at minimum
docker compose up -d --build
curl http://localhost:3000/api/v1/health
docker compose --profile gui up -d   # optional: pgAdmin + Adminer
```

Startup order is `postgres` (healthy) → `migrate` (a one-shot `node scripts/migrate.mjs`, must exit
0) → `server`. The GUI tools reach whichever Postgres you point them at through
`host.docker.internal`. Set `CORS_ORIGINS` for any browser origin in production; unset, production
allows none.

Postgres's container publishes to host port **5432** by default — the same port the host
Postgres above uses — so override `POSTGRES_HOST_PORT` in `.env` first if a host Postgres is
already running, or the two will collide. `mobile/` isn't containerized (Expo's dev server needs direct
LAN/USB access to a physical device, which containerizing complicates for no gain), and neither is
`webpage/` (parked — see `webpage/PARKED.md`, it doesn't run against the current API at all).

The original `docker-compose.yml` here was removed rather than rewritten for the old stack: it
built two services from `./backend` and `./frontend`, which no longer exist, so it could not
start at all, and the API had no Dockerfile at the time.

## Status

Schema, shared contract, API specification, and CI are complete and machine-checked. All 49 user
stories in [`SRS.md` §9](SRS.md#9-features--user-stories) are realized end-to-end on the API side;
[`SDS.md` §8](SDS.md#8-feature-implementation-mapping) tracks the one open item (a mobile UI for
the dashboard's optional currency-converted total — the API and contract are already complete).

## Security

Argon2id password hashing with a length-only policy (12–200 characters, no composition rules —
those measurably push users toward predictable substitutions). HS256 access tokens live 15
minutes; refresh tokens live 7 days, are single-use and rotated, and **only their hashes are
stored**, so a database read cannot mint a session. Presenting an already-revoked refresh token
revokes that user's entire token family: replay means the token was stolen, and ending every
session is the safe response.

Login returns an identical `401` for an unknown email and a wrong password, so it cannot be used
to enumerate registered addresses. A caller with no membership on a wallet gets `404`, not
`403` — `403` would confirm the resource exists to someone who cannot read it.

Nothing financial is hard-deleted: wallets, accounts, categories and budgets are archived,
transactions are cancelled, members are revoked. Transactions are the source of truth for every
derived figure, so a destroyed row would silently change historical answers.

## License

MIT
