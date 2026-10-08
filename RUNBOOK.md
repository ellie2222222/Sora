# RUNBOOK

Operational procedures for the Sora API. This is the "something is wrong, what do I
do" document — for project structure and conventions see [CLAUDE.md](CLAUDE.md); for setup and
architecture see [README.md](README.md).

**Referenced but not yet written before now:** `aif-sdlc-checklist.md` and `SDS.md` both pointed
at this file; it didn't exist. **`SRS.md` and `SDS.md` are stale against the current code** (they
predate the wallet-model rewrite in places) — don't treat them as authoritative for anything
operational; this file and `CLAUDE.md` are.

## What's actually deployed

Only one service runs in production: **`server/`** (NestJS API) against **PostgreSQL**.
`mobile/` is a client the API doesn't host. `webpage/` is parked — see `webpage/PARKED.md` — and
is never deployed.

| | |
|---|---|
| API | `http://localhost:3000` (local) — `PORT` / `API_HOST_PORT` (Docker) |
| Health check | `GET /api/v1/health` → `{"status","version","database"}`, `200` or `503` |
| Database | `postgresql://<user>:<pass>@<host>:5432/<db>` via `DATABASE_URL` |

## Data safety — read before touching a real database

This is financial data. A destroyed transaction row silently rewrites every balance, budget
figure and goal total derived from it, with nothing in the app reporting that the answers
changed. Full detail in [CLAUDE.md](CLAUDE.md)'s Data Safety section; the essentials:

- **Never** run `DROP DATABASE`/`DROP SCHEMA`, `TRUNCATE`, a `DELETE`/`UPDATE` with no `WHERE`, or
  restore a dump over existing data — on anything that isn't disposable. Ask first, even mid-incident.
- `node scripts/migrate.mjs --reset` refuses any database whose name doesn't match
  `dev|test|local|check|scratch|ci` unless `ALLOW_DESTRUCTIVE_RESET=yes` is set. Don't set that
  override against a database you didn't create for the purpose.
- Applied migrations are immutable and checksummed — the runner refuses to re-run one whose file
  changed. If a migration shipped wrong, write a new migration; don't edit the old file.
- Nothing financial is hard-deleted by design (wallets/accounts/categories archive,
  transactions are marked `DELETED`, members revoke). The exceptions are a category with no
  transactions and no budget on it or any descendant (`?mode=permanent`, API spec §10.4), and a
  budget, which only plans (API spec §12.5). Anything
  else that looks hard-deleted is a bug, not a feature to work around.

## Deploying

**Primary path — host Postgres + npm** (see README's Setup section for first-time install):

```bash
git pull
npm install
node scripts/migrate.mjs               # applies db/migrations/*.sql in order, idempotent
npm run build --workspace @sora/contracts
npm run build --workspace @sora/server
npm start --workspace @sora/server  # or: npm run dev:server for watch mode
```

**Optional path — Docker** (covers `server/` + Postgres only; nothing else is containerized):

```bash
cp .env.example .env   # fill in at least JWT_SECRET and GOOGLE_CLIENT_ID
docker compose up -d --build
curl http://localhost:3000/api/v1/health
docker compose --profile gui up -d   # optional: pgAdmin + Adminer
```

`server` starts only after the one-shot `migrate` service exits 0 — if it never comes up, check
`rtk proxy docker compose logs migrate` first. The image's `HEALTHCHECK` probes
`/api/v1/health`, so `docker compose ps` shows `healthy` only once the database is reachable.

Postgres's container publishes to host port **5432** by default — the same port a host Postgres
would use — so override `POSTGRES_HOST_PORT` in `.env` first if something's already listening on
5432, or the two will collide.

**After any deploy**, confirm the health check reports `"database": "up"` — a `503` with
`"database": "down"` means the API started but can't reach Postgres (see below).

## Building the mobile app

Expo bakes every `EXPO_PUBLIC_*` value into the bundle at build time, so set the API URL **before**
building. A release build refuses a plain `http://` API URL at startup (`apiUrlPolicy.ts`) unless
`EXPO_PUBLIC_ALLOW_INSECURE_API=true`; Android also blocks cleartext in a release build unless the
prebuild ran with `SORA_E2E_BUILD=1` (`app.config.js`). Use both only for a LAN or emulator build.

**Cloud, with EAS** (`mobile/eas.json`; project `tam-le-team/sora` in `app.json`). `mobile/.env` is
gitignored and isn't uploaded, so give the build its URL as an EAS environment variable or in the
profile's `env` in `eas.json`:

```bash
cd mobile
npx eas-cli login
npx eas-cli build --platform android --profile preview      # internal build, install link printed at the end
npx eas-cli build --platform android --profile production   # store build, version auto-incremented
```

The `development` profile needs `expo-dev-client`, which isn't a dependency yet.

**Local APK, no EAS account.** `mobile/android/` is generated (gitignored); `--clean` rebuilds it.
The release APK is signed with the debug key, which is fine for sideloading but not for a store.

```bash
cd mobile
npx expo prebuild --platform android --clean --no-install
cd android
EXPO_PUBLIC_API_BASE_URL=https://api.example.com NODE_ENV=production ./gradlew assembleRelease
adb install -r app/build/outputs/apk/release/app-release.apk
```

`./gradlew assembleDebug` instead builds an APK that loads JavaScript from Metro
(`npm run dev:mobile`). The E2E APK, which talks to a local API over plain HTTP, has its own steps in
[`mobile/e2e/README.md`](mobile/e2e/README.md). Reaching a local API from an emulator or phone:
[`docs/DEVICE_NETWORKING.md`](docs/DEVICE_NETWORKING.md).

## Demo data

`npm run db:seed` (`scripts/seed/`, [plan](plans/tooling/seed-data-plan.md)) writes a year of data for
four users through a **running API**: about 2,700 transactions plus every account, category, budget
and goal kind. It then reads everything back and checks it. It only adds data, and nothing removes
it but dropping the database, so point it at a database you can lose: a fresh one, or an empty
local `sora_dev`.

```bash
npm run db:seed -- --dry-run                                    # build and check the ledger, no API call
SEED_API_URL=http://127.0.0.1:3000 npm run db:seed              # seed what the API at :3000 writes to
SEED_API_URL=… npm run db:seed -- --guest-fixture demo.json     # also write An's wallet as guest-mode data
```

Logins go to `.env.seed`, created ids to `.seed/<runId>.json` (both gitignored); sign in as
`SEED_AN_EMAIL`. `SEED` (default 2) and `SEED_ANCHOR` (default: today in Vietnam) fix the data, so
seed on the day of a demo. The exchange-rate check needs an API booted with
`EXCHANGE_RATE_API_URL=http://127.0.0.1:3418 EXCHANGE_RATE_CACHE_TTL_MINUTES=1` against
`node scripts/seed/rates-stub.mts`, plus `SEED_RATES_URL=http://127.0.0.1:3418`. The stub's rates
land in that database's snapshot table, so use a scratch database for it.

Guest-mode demo data, in a development build: write the fixture, serve it, and start Metro with its
URL, then use guest Settings → "Load demo data" (it replaces the guest data on that device).

```bash
npm run db:seed -- --dry-run --guest-fixture demo.json
node scripts/seed/serve-guest-fixture.mts demo.json            # http://127.0.0.1:3420/; FIXTURE_HOST=0.0.0.0 for a phone
EXPO_PUBLIC_DEMO_FIXTURE_URL=http://10.0.2.2:3420/ npm run dev:mobile
SEED_API_URL=… node scripts/seed/guest-upload-check.mts demo.json   # the guest → account upload, checked from Node
```

## Database migrations

```bash
node scripts/migrate.mjs               # apply pending migrations
node scripts/migrate.mjs --status      # list applied/pending, changes nothing
node scripts/migrate.mjs --constraints # apply, then run db/tests/*.sql constraint probes
node scripts/migrate.mjs --reset       # DROP everything, re-apply — guarded, see Data Safety
```

Connection comes from `DATABASE_URL` (or `PG*` env vars `pg` reads natively). A migration whose
already-applied file content changed is refused outright with a message naming the file — that
means someone edited a shipped migration; write a new one instead of trying to force it through.

The schema is one file, `db/migrations/001_schema.sql`; the 13 pre-production migrations were folded
into it on 2026-10-05. A database built from those older files fails with `relation "users" already
exists`. Rebuild it with `npm run db:reset` (its name must look disposable). For the Docker stack,
recreate its volume.

## Configuration

`server/src/config/env.ts` is the **single authoritative source** for every environment variable
— it validates all of them once at boot with Zod and refuses to start on anything missing or
unusable (an empty or 8-character `JWT_SECRET` fails loudly here rather than authenticating
nothing silently later). `.env.example` mirrors its names, but if the two ever disagree **`env.ts`
wins**; if the app won't boot over a variable name, check there first, not the example file.

Required with no default: `DATABASE_URL`, `JWT_SECRET` (min 32 chars), `GOOGLE_CLIENT_ID`.

**Rotating `JWT_SECRET`** invalidates every outstanding access and refresh token immediately —
every signed-in user is forced to log in again. There is no dual-secret grace period. Only do
this deliberately (suspected leak, scheduled rotation), and expect a support-load spike right
after.

## Troubleshooting

**API won't start, process exits immediately with `Invalid environment configuration`.**
Expected behavior, not a crash — `env.ts` rejected a variable. The error lists exactly which
key(s) and why. Fix the variable named in the error; don't work around it by relaxing the schema.

**Health check returns `503` / `"database": "down"`.** API is up but can't reach Postgres — check
`DATABASE_URL` resolves from where the API is actually running (a Docker-internal hostname isn't
reachable from the host and vice versa), and that Postgres itself is up
(`docker compose ps` / `pg_isready`).

**A request that should exist returns `404` instead of `403`.** This is very likely correct, not
a bug: a caller with no membership row on a wallet gets `404` by design (existence is not
leaked to non-members) — `403` is reserved for "member, but role too low." Check membership before
assuming the route is broken.

**A `500` coming out of Postgres on an otherwise-valid-looking request.** Usually a drift between
`@sora/contracts` and the database schema (enums, error codes, routes) — the two are supposed
to agree exactly. Run:

```bash
node scripts/check-contract-parity.mjs
```

It checks enum tuples against `CHECK` constraints in both directions, every error code against
its status, and every route against `docs/API_SPECIFICATION.md`. Whatever it flags is the
mismatch to fix — don't patch around the symptom.

**A balance, budget `spent`, or goal progress figure looks wrong / won't reconcile.** Nothing
stores a running total — every one of these is derived from `transactions` on read. First rule
out a float ever having touched an amount: money crosses the wire as a string and is computed as
scaled `bigint` (`packages/contracts/src/money.ts`); `node-postgres` parses `NUMERIC`/`BIGINT`
into JS numbers by default, so if `server/src/database/pg-types.ts`'s type-parser overrides were
ever removed or bypassed, reads silently round. Confirm those overrides are still in place before
looking anywhere else.

**Ownership transfer / promoting a member fails with a unique-constraint violation.**
`uq_wallet_single_owner` rejects two `ACTIVE` owners even momentarily — a naive promote-then-demote
fails outright. The transfer must demote the old owner and promote the new one inside one
transaction, with `SELECT ... FOR UPDATE` taken on the membership rows first.

**CI is green but a job you'd expect to fail didn't run at all.** Check whether that job has a
`hashFiles()` condition at *job* level — job-level `if:` evaluates before checkout, so
`hashFiles()` always sees nothing and the job silently no-ops. Guard at step level (after
`actions/checkout`) or use `needs:` instead.

## Backup / restore

No project-specific backup tooling exists yet — use plain Postgres tools against `DATABASE_URL`:

```bash
pg_dump "$DATABASE_URL" -F c -f backup.dump
pg_restore -d "$DATABASE_URL" backup.dump   # only into an empty/disposable database — see Data Safety
```

Restoring over a database with existing data is exactly the "restoring a dump over existing data"
case the Data Safety rules forbid without asking first.

## CI reference

`.github/workflows/ci.yml` runs six jobs: **contracts** (types, unit tests, contract/schema
parity), **database** (migrate against real Postgres, run constraint suites, then re-run to prove
migrations are idempotent), **server** (typecheck, migrate a test database, run tests), **mobile**
(typecheck, tests, and an `expo export` bundle as a first signal that every import resolves),
**e2e** (after server and mobile: builds the E2E APK and runs `mobile/e2e` on an Android emulator),
and **audit** (runtime dependency advisories; nothing waits on it).

## Monitoring / alerting

None configured. There's no APM, error tracker, or alert routing wired up today — the only signal
is the `/api/v1/health` endpoint and process/container logs (stdout only; no file or log
aggregator). Anyone standing up monitoring should update this section rather than leaving it
stale like `SRS.md`/`SDS.md`.
