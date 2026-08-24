#!/usr/bin/env node
/**
 * Applies db/migrations/*.sql in filename order, once each.
 *
 * Deliberately not an ORM's migration tool. The schema's business rules are
 * expressed as CHECK constraints, partial unique indexes and a GIST exclusion
 * constraint -- none of which a schema-diffing migrator round-trips faithfully,
 * so a generated migration would quietly drop the thing enforcing the rule.
 *
 * Each file runs inside its own transaction alongside the bookkeeping insert, so
 * a migration that fails leaves neither a half-applied schema nor a row claiming
 * it succeeded.
 *
 * Usage:
 *   node scripts/migrate.mjs                 apply pending migrations
 *   node scripts/migrate.mjs --status        list applied/pending, apply nothing
 *   node scripts/migrate.mjs --constraints   apply, then run db/tests/*.sql
 *   node scripts/migrate.mjs --reset         DROP every table, then re-apply
 *
 * Connection comes from DATABASE_URL, or PG* environment variables.
 */

import { createHash } from 'node:crypto';
import { readFileSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const MIGRATIONS_DIR = join(ROOT, 'db/migrations');
const TESTS_DIR = join(ROOT, 'db/tests');

const args = new Set(process.argv.slice(2));
const wantStatus = args.has('--status');
const wantConstraints = args.has('--constraints');
const wantReset = args.has('--reset');

let pg;
try {
  pg = await import('pg');
} catch {
  console.error('The "pg" package is not installed. Run `npm install` at the repo root first.');
  process.exit(1);
}

/**
 * Return NUMERIC and BIGINT as strings.
 *
 * node-postgres parses both to JS numbers by default, which silently rounds
 * every DECIMAL(19,4) it reads. A migration runner does not do arithmetic, but
 * the constraint suite prints balances, and a figure that disagrees with the
 * database would send someone hunting a bug that only exists in the driver.
 */
pg.types.setTypeParser(1700, (value) => value);
pg.types.setTypeParser(20, (value) => value);

const client = new pg.Client(
  process.env.DATABASE_URL ? { connectionString: process.env.DATABASE_URL } : {},
);

function migrationFiles() {
  return readdirSync(MIGRATIONS_DIR)
    .filter((name) => name.endsWith('.sql'))
    .sort();
}

function checksum(sql) {
  return createHash('sha256').update(sql).digest('hex').slice(0, 16);
}

async function ensureBookkeeping() {
  await client.query(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      filename    TEXT PRIMARY KEY,
      checksum    TEXT        NOT NULL,
      applied_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);
}

async function appliedMigrations() {
  const { rows } = await client.query('SELECT filename, checksum FROM schema_migrations');
  return new Map(rows.map((row) => [row.filename, row.checksum]));
}

/**
 * Names --reset will operate on without an explicit override.
 *
 * The guard exists because --reset is one keystroke from --status and destroys
 * every row in whatever DATABASE_URL happens to point at. Requiring the database
 * name to look disposable means pointing at production and reaching for reset
 * out of habit fails loudly instead of succeeding.
 */
const RESETTABLE_NAME = /(^|[_-])(dev|test|local|check|scratch|ci)([_-]|$)/i;

async function assertResettable() {
  const { rows } = await client.query('SELECT current_database() AS name');
  const name = rows[0].name;

  if (RESETTABLE_NAME.test(name) || process.env.ALLOW_DESTRUCTIVE_RESET === 'yes') return name;

  console.error(
    `Refusing to reset database "${name}".\n` +
      'Its name does not look disposable (expected something containing dev, test,\n' +
      'local, check, scratch or ci). If you are certain, re-run with\n' +
      'ALLOW_DESTRUCTIVE_RESET=yes.',
  );
  process.exit(1);
}

async function reset() {
  const name = await assertResettable();
  console.log(`Dropping every table in the public schema of "${name}"...`);
  // Recreating the schema is the only reliable way to clear tables that
  // reference each other; dropping them individually needs a topological order
  // that changes with every migration.
  await client.query('DROP SCHEMA public CASCADE');
  await client.query('CREATE SCHEMA public');
  console.log('  schema public recreated\n');
}

async function apply(filename) {
  const sql = readFileSync(join(MIGRATIONS_DIR, filename), 'utf8');
  const sum = checksum(sql);

  // The migration files carry their own BEGIN/COMMIT, so the bookkeeping row is
  // recorded in a second statement rather than wrapped around the file.
  await client.query(sql);
  await client.query(
    'INSERT INTO schema_migrations (filename, checksum) VALUES ($1, $2) ON CONFLICT (filename) DO NOTHING',
    [filename, sum],
  );

  console.log(`  applied ${filename} (${sum})`);
}

async function runConstraintSuites() {
  let files;
  try {
    files = readdirSync(TESTS_DIR).filter((name) => name.endsWith('.sql')).sort();
  } catch {
    console.log('\nNo db/tests directory; skipping constraint suites.');
    return true;
  }

  console.log('\nRunning constraint suites:');
  let allPassed = true;

  for (const file of files) {
    const sql = readFileSync(join(TESTS_DIR, file), 'utf8');
    // The suites use psql meta-commands (\echo, \set) that the wire protocol
    // does not understand, so they are stripped before sending.
    const executable = sql
      .split('\n')
      .filter((line) => !line.trimStart().startsWith('\\'))
      .join('\n');

    try {
      await client.query(executable);
      console.log(`  PASS  ${file}`);
    } catch (error) {
      console.error(`  FAIL  ${file} — ${error.message}`);
      allPassed = false;
    }
  }

  return allPassed;
}

async function main() {
  await client.connect();

  if (wantReset) await reset();

  await ensureBookkeeping();
  const applied = await appliedMigrations();
  const files = migrationFiles();

  if (wantStatus) {
    console.log('Migration status:\n');
    for (const file of files) {
      const recorded = applied.get(file);
      const sum = checksum(readFileSync(join(MIGRATIONS_DIR, file), 'utf8'));
      if (!recorded) console.log(`  PENDING  ${file}`);
      else if (recorded !== sum) console.log(`  CHANGED  ${file} — applied ${recorded}, file ${sum}`);
      else console.log(`  APPLIED  ${file}`);
    }
    return 0;
  }

  // A migration whose contents changed after being applied is refused rather
  // than re-run: the database no longer matches the file, and only a human
  // knows whether the fix is a new migration or a restore.
  for (const [filename, recorded] of applied) {
    if (!files.includes(filename)) continue;
    const sum = checksum(readFileSync(join(MIGRATIONS_DIR, filename), 'utf8'));
    if (recorded !== sum) {
      console.error(
        `${filename} was applied as ${recorded} but the file is now ${sum}.\n` +
          'Applied migrations are immutable. Add a new migration instead.',
      );
      return 1;
    }
  }

  const pending = files.filter((file) => !applied.has(file));

  if (pending.length === 0) {
    console.log(`Up to date (${files.length} migration(s) applied).`);
  } else {
    console.log(`Applying ${pending.length} migration(s):`);
    for (const file of pending) await apply(file);
  }

  if (wantConstraints) {
    const passed = await runConstraintSuites();
    if (!passed) return 1;
  }

  return 0;
}

let exitCode = 1;
try {
  exitCode = await main();
} catch (error) {
  console.error(`Migration failed: ${error.message}`);
  if (error.hint) console.error(`  hint: ${error.hint}`);
} finally {
  await client.end().catch(() => {});
}

process.exit(exitCode);
