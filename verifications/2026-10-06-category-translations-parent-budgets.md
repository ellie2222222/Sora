# Starter-category translations, sign-up language, and parent-category budgets

**Date:** 2026-10-06T04:46:08Z
**Method:** scratch-probe skill (disposable Postgres) + ad hoc unit/typecheck runs
**Verdict:** PASS
**Scope:** The change set adding `categories.system_key` + `category_translations`, request-locale resolution (Accept-Language → saved locale → `en`), localized category names on every read, rename-makes-custom, the localized duplicate-name check, the sign-up language picker, and category budgets counting their subcategories. Scoped from the diff and API spec §2.11, §5.1, §5.6, §10.1–10.3, §12.2.
**Files touched:** none by this pass beyond the tests it added (see the change summary)
**Related reports:** 2026-10-05-schema-baseline-consolidation.md (the uncommitted `001_schema.sql` these changes fold into)

## Method

Baseline recorded first: `docker ps -a --format '{{.Names}} {{.Ports}}'` (10 containers, including `sora-postgres` on 127.0.0.1:5432, left untouched) and `docker volume ls -qf dangling=true` (20 volumes).

```bash
docker run -d --name scratch-i18n-685d -e POSTGRES_USER=scratch -e POSTGRES_PASSWORD=scratch-pw \
  -e POSTGRES_DB=scratch_i18n_685d -p 127.0.0.1:55552:5432 postgres:17
docker exec scratch-i18n-685d pg_isready -U scratch -d scratch_i18n_685d     # polled until ready
DATABASE_URL=postgresql://scratch:scratch-pw@127.0.0.1:55552/scratch_i18n_685d node scripts/migrate.mjs --constraints   # twice
docker exec scratch-i18n-685d psql -U scratch -d scratch_i18n_685d -Atc "SELECT locale, COUNT(*) FROM category_translations GROUP BY locale ..."
DATABASE_URL=… npm test -w @sora/server                                       # unit + integration, in-process API
docker rm -f -v scratch-i18n-685d
```

Without a database: `npm run typecheck`, `npm test` (all packages), `node scripts/check-contract-parity.mjs`, `npm run agents:check`.

## Findings

1. **Migration applies and is idempotent** — first run `applied 001_schema.sql (fb77af531a263ff7)`; second run `Up to date (1 migration(s) applied)`. PASS
2. **Constraint probes** — `PASS 001_constraints.sql`, `PASS 002_ai_messages.sql` on both runs, including the new probes: a starter with its key accepted; a second copy of one starter in a wallet rejected (`uq_category_system_key`); the same starter in another wallet accepted; en/vi row counts equal; a second name for one key+locale rejected (`uq_category_translation`); `fr` rejected (`chk_category_translation_locale`). PASS
3. **Translation rows read back** — `en|38`, `vi|38`; `food en Food`, `food vi Ăn uống`, `repairs_maintenance vi Sửa chữa & bảo dưỡng`. PASS
4. **Server suite on the real database** — `tests 241, pass 241, fail 0, skipped 0`. The new integration cases all passed:
   - names a starter in the Accept-Language locale, a custom one as typed (`integration.categories:204`) — PASS
   - falls back to the saved locale, then English for an unsupported header (`:216`) — PASS
   - names starter categories on transactions in the request locale (`:224`) — PASS
   - rejects a custom name equal to a starter as the caller reads it, 409 `CATEGORY_DUPLICATE_NAME` (`:234`) — PASS
   - resending the displayed name keeps `systemKey`; a real rename clears it (`:243`) — PASS
   - a category budget counts parent + child + grandchild (300), a child budget its own subtree (200), `categoryIds` lists the subtree (`integration.budgets:251`) — PASS
   - registration seeds every starter with its `system_key` and English name (`integration.auth`, `integration.session`) — PASS
5. **Parity** — `65/65 parity checks passed`, including the 7 new: LOCALES vs `chk_user_locale` and `chk_category_translation_locale`; every `STARTER_CATEGORIES` name has a matching migration row and vice versa; every starter named in every locale. PASS
6. **Unit suites** — contracts 143/143, server (no DB) 66/66, mobile 637/637; `npm run typecheck` exit 0. PASS

Not exercised: the mobile sign-up screen and Accept-Language header on a device (no app run this pass); the dashboard and AI snapshot name paths are covered only by the shared SQL helper they call, not by their own integration assertions.

## Fixes Applied

`packages/contracts/test/starter-categories.test.ts` still read the removed `StarterCategory.name`; contracts tests aren't part of `npm run typecheck`, so only `npm test` caught it. Updated to `names` and extended to every locale; re-ran `npm test -w @sora/contracts`: 143/143.

## Teardown

`docker rm -f -v scratch-i18n-685d` removed the container and its volume. Re-ran both listings: `diff` against the baseline showed no change for containers or dangling volumes.

## Follow-ups

- Run the app once: pick Tiếng Việt on sign-up, confirm the wallet reads "Ví của …" and starter categories switch language with the app setting.
- Guest mode's own seeded wallet ("Guest Wallet"/"Cash") is still English-only; only its starter categories are localized.
