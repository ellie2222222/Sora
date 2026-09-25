---
name: scratch-probe
description: >-
  Exercises a changed server path end to end against a disposable Postgres and a freshly built API:
  a uniquely named container, migrations applied, the server booted on a spare port, synthetic
  probe data driven through the real endpoints, side effects read back with psql, then everything
  this run created torn down by its exact name. Use when asked to "test it against a real database",
  "exercise the endpoint live", "prove the write path works", "probe the API", or when a
  double-check needs the changed read/write path run on real, non-empty data -- distinct from the
  bundled `/verify` (a different protocol with a colliding name, so this one is deliberately not
  called verify) and from `double-check` (decides *what* needs exercising; this skill is *how*).
---

# Scratch Probe

Runs the real server against a database nobody else owns, so a write path, a constraint or a
transaction boundary is observed rather than assumed. Everything it creates is disposable, named so
it can't be mistaken for anything else, and removed at the end.

Read the repo's conventions doc (`CLAUDE.md` or equivalent) fresh every run — especially its data
safety, destructive-command and test-data-cleanup rules. They govern every step below.

## Non-negotiable constraints

- **Never touch a database or container this run did not create.** Before starting, record
  `docker ps -a` (every existing name and published port) and `docker volume ls -qf dangling=true`;
  the scratch instance must collide with none of them. Finding someone else's container is a reason
  to leave it alone, not to reuse it.
- **Unique names everywhere.** Container `scratch-<slug>-<4 hex>`, database `scratch_<slug>_<4 hex>`,
  probe users `probe+<uuid>@example.invalid`, entity names `scratch-<uuid>`.
- **Cleanup by exact name only.** `docker rm -f -v <that container>` — never `prune`, never a wildcard,
  never "everything created today". The `-v` matters: the postgres image declares a data volume, and
  without it every run leaves an orphaned ~50 MB anonymous volume behind. Stop the server by the PID
  listening on the port this run chose, after confirming it's the node process this run started.
- **No consequential external calls.** Leave paths that reach a third-party API (e.g. exchange rates)
  unexercised unless that call is mocked or the user has explicitly agreed to it.
- **Probe scripts live in the scratchpad, never in the repo.**

## Phase 0 — Scope

Name the exact endpoints and behaviours to prove: the happy path, each documented error, the
authorization boundary (this repo: 404 for a non-member vs 403 for a member whose role is too low),
and any side effect (audit rows, derived figures). Take them from the diff and the API specification
— not a generic smoke test.

## Phase 1 — Stand up

1. Start Postgres at the version the repo targets (its CI config says which) on a free port, with
   the unique names above. Wait with `pg_isready` rather than a fixed sleep.
   No container runtime? Use a throwaway `initdb` + `pg_ctl` cluster on a non-default port instead.
2. Apply migrations with the repo's own runner (with its constraint probes too, if the schema changed).
3. Build the server and start it in the background on a free port. Pass the minimum environment the
   config validator demands, with obviously fake values for secrets. Wait until the health endpoint
   reports the database up.

## Phase 2 — Probe

- Write one probe script (the scratchpad) that registers probe users, creates the fixtures, and calls
  each scoped endpoint. It should print method, path, status and the relevant response fields.
- For the authorization boundary, use a second probe user: one with no membership, and one with a
  role that's too low.
- Read side effects back directly with `psql` against the scratch database.
- To prove a failure path (a rollback, a savepoint, a constraint), inject the failure *inside the
  scratch database only* — e.g. a scratch-named trigger — and observe what the API does.
- Non-empty data, always: an empty table hides serialization, join and optional-field bugs.

## Phase 3 — Tear down and confirm

Stop the server, remove the container and its volume by its exact name (`docker rm -f -v`), then
re-run both listings recorded before starting. Each should match its baseline exactly: nothing this
run created left behind, nothing that was already there gone.

## Phase 4 — Report

Write the repo's usual dated verification report. Include:
- the container name, port and image;
- every command run;
- each probe with its observed status and fields;
- the rows read back;
- the teardown confirmation.

Give each scoped behaviour its own PASS/FAIL. A path that couldn't be reached is BLOCKED, not a pass.
