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
| API | `http://localhost:3001` (local) — `PORT` / `API_HOST_PORT` (Docker) |
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
- Nothing financial is hard-deleted by design (wallets/accounts/categories/budgets archive,
  transactions cancel, members revoke). If something looks hard-deleted, that's a bug, not a
  feature to work around.

## Deploying

**Primary path — host Postgres + npm** (see README's Setup section for first-time install):

```bash
git pull
npm install
node scripts/migrate.mjs               # applies db/migrations/*.sql in order, idempotent
npm run build --workspace @sora/contracts
npm run build --workspace @sora/server
npm start --workspace @sora/server  # or: npm run start:dev for watch mode
```

**Optional path — Docker** (covers `server/` + Postgres only; nothing else is containerized):

```bash
cp .env.example .env   # fill in at least JWT_SECRET and GOOGLE_CLIENT_ID
docker compose up -d --build
curl http://localhost:3001/api/v1/health
```

Postgres's container publishes to host port **5433** (not 5432) so it can run alongside a host
Postgres without colliding — override `POSTGRES_HOST_PORT` in `.env` if nothing is on 5432.

**After any deploy**, confirm the health check reports `"database": "up"` — a `503` with
`"database": "down"` means the API started but can't reach Postgres (see below).

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

## Configuration

`server/src/config/env.ts` is the **single authoritative source** for every environment variable
— it validates all of them once at boot with Zod and refuses to start on anything missing or
unusable (an empty or 8-character `JWT_SECRET` fails loudly here rather than authenticating
nothing silently later). `.env.example` and `env.ts` are known to disagree on a few names
(`API_PORT` vs `PORT`, `JWT_ACCESS_TTL` vs `ACCESS_TOKEN_TTL_SECONDS`) — **`env.ts` wins**; if the
app won't boot over a variable name, check there first, not the example file.

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

`.github/workflows/ci.yml` runs four jobs: **contracts** (types, unit tests, contract/schema
parity — everything else depends on this), **database** (migrate against real Postgres, run
constraint suites, then re-run to prove migrations are idempotent), **server** (typecheck, migrate
a test database, run tests), **mobile** (typecheck, tests, and an `expo export` bundle as a proxy
for "the app would start," since no emulator runs in CI).

## Monitoring / alerting

None configured. There's no APM, error tracker, or alert routing wired up today — the only signal
is the `/api/v1/health` endpoint and process/container logs (stdout only; no file or log
aggregator). Anyone standing up monitoring should update this section rather than leaving it
stale like `SRS.md`/`SDS.md`.
