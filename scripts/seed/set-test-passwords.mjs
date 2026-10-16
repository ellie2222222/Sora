// Gives the accounts the last seed run created (.env.seed) an easy password, default "1", for local testing.
// Login accepts any non-empty password; only registration enforces 12+ characters, so this writes the hash
// directly. It touches only those exact seed emails, and only on a database whose name looks disposable.
//
//   npm run db:seed:passwords            password "1"
//   SEED_PASSWORD=abc npm run db:seed:passwords

import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import argon2 from 'argon2';
import pg from 'pg';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '../..');
const ENV_SEED = process.env.SEED_ENV_FILE ?? join(ROOT, '.env.seed');
// The same rule migrate.mjs --reset uses for "this database was made to be thrown away".
const DISPOSABLE_NAME = /(^|[_-])(dev|test|local|check|scratch|ci)([_-]|$)/i;
// A run's own addresses, or the short ones a local database's seed accounts may be renamed to.
const SEED_EMAIL = /^(seed\+[a-z]+-[0-9a-f]{8}@example\.invalid|[a-z]+@sora\.test)$/;
// The server's own parameters, so a hash written here is indistinguishable from one it wrote.
const ARGON2_OPTIONS = { type: argon2.argon2id, memoryCost: 19456, timeCost: 2, parallelism: 1 };

function fail(message) {
  console.error(message);
  process.exit(1);
}

const password = process.env.SEED_PASSWORD ?? '1';
if (password.length === 0) fail('SEED_PASSWORD must not be empty: login rejects an empty password.');

if (!process.env.DATABASE_URL) {
  try {
    process.loadEnvFile(join(ROOT, '.env'));
  } catch {
    // No .env: rely on the environment.
  }
}

let envSeed;
try {
  envSeed = readFileSync(ENV_SEED, 'utf8');
} catch {
  fail('No .env.seed: run `npm run db:seed` first.');
}
const emails = [...envSeed.matchAll(/^SEED_[A-Z]+_EMAIL=(.+)$/gm)].map((match) => match[1].trim());
if (emails.length === 0) fail('.env.seed lists no SEED_*_EMAIL.');
const foreign = emails.filter((email) => !SEED_EMAIL.test(email));
if (foreign.length > 0) fail(`Refusing: not seed addresses: ${foreign.join(', ')}`);

const client = new pg.Client(process.env.DATABASE_URL ? { connectionString: process.env.DATABASE_URL } : {});
await client.connect();
try {
  const { rows } = await client.query('SELECT current_database() AS name');
  const database = rows[0].name;
  if (!DISPOSABLE_NAME.test(database)) {
    fail(`Refusing database "${database}": its name doesn't look disposable (dev, test, local, check, scratch or ci).`);
  }

  const hash = await argon2.hash(password, ARGON2_OPTIONS);
  await client.query('BEGIN');
  const updated = await client.query(
    'UPDATE users SET password_hash = $1, updated_at = NOW() WHERE email = ANY($2::text[])',
    [hash, emails],
  );
  if (updated.rowCount !== emails.length) {
    await client.query('ROLLBACK');
    fail(`Expected ${emails.length} seed users in "${database}", found ${updated.rowCount}; nothing changed. Is .env.seed from a run against this database?`);
  }
  await client.query('COMMIT');

  writeFileSync(ENV_SEED, envSeed.replace(/^(SEED_[A-Z]+_PASSWORD=).*$/gm, `$1${password}`));
  console.log(`${database}: ${emails.length} seed accounts now sign in with password "${password}":`);
  for (const email of emails) console.log(`  ${email}`);
} finally {
  await client.end();
}
