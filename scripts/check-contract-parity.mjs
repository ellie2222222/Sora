#!/usr/bin/env node
/**
 * Asserts the contract agrees with the schema (enum tuples vs CHECK constraints, both
 * ways), the API specification (every route documented) and itself (every error code
 * has a status). An enum drift surfaces as a 500 from Postgres, not a validation error.
 *
 * Reads the migration SQL as text, so it runs in CI with no database.
 *
 * Usage: node scripts/check-contract-parity.mjs
 */

import { readdirSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');

// In the migrator's filename order, so constraintValues() sees a later redefinition last.
const MIGRATIONS_DIR = join(ROOT, 'db/migrations');
const SCHEMA_SQL = readdirSync(MIGRATIONS_DIR)
  .filter((name) => name.endsWith('.sql'))
  .sort()
  .map((name) => readFileSync(join(MIGRATIONS_DIR, name), 'utf8'))
  .join('\n');
const ENUMS_TS = readFileSync(join(ROOT, 'packages/contracts/src/enums.ts'), 'utf8');
const ROUTES_TS = readFileSync(join(ROOT, 'packages/contracts/src/routes.ts'), 'utf8');
const API_SPEC = readFileSync(join(ROOT, 'docs/API_SPECIFICATION.md'), 'utf8');

const failures = [];
const checks = [];

function check(label, ok, detail = '') {
  checks.push({ label, ok });
  if (!ok) failures.push(`${label}${detail ? ` — ${detail}` : ''}`);
}

/**
 * Values a named CHECK constraint admits, read out of its IN (...) list.
 * Takes the *last* match in migration-applied order, so a later migration's
 * `DROP CONSTRAINT` + `ADD CONSTRAINT` redefinition wins over the original
 * CREATE TABLE definition — matching how Postgres itself ends up seeing it.
 */
function constraintValues(constraintName) {
  const pattern = new RegExp(
    `CONSTRAINT\\s+${constraintName}\\s*\\n?\\s*CHECK\\s*\\(([^;]*?)\\)\\s*(?:,|\\n\\s*\\)|;)`,
    'gs',
  );
  const matches = [...SCHEMA_SQL.matchAll(pattern)];
  if (matches.length === 0) return null;
  const values = [...matches[matches.length - 1][1].matchAll(/'([A-Z_]+)'/g)].map((m) => m[1]);
  return values.length > 0 ? values.sort() : null;
}

/** Members of an `export const NAME = [...] as const` tuple. */
function contractMembers(constName) {
  const pattern = new RegExp(`export const ${constName} = \\[([^\\]]*)\\] as const`, 's');
  const match = ENUMS_TS.match(pattern);
  if (!match) return null;
  return [...match[1].matchAll(/'([A-Z_]+)'/g)].map((m) => m[1]).sort();
}

function sameSet(a, b) {
  return a !== null && b !== null && a.length === b.length && a.every((v, i) => v === b[i]);
}

// ---------------------------------------------------------------------------
// 1. Enum members vs CHECK constraints
// ---------------------------------------------------------------------------

const ENUM_TO_CONSTRAINT = [
  ['WALLET_ROLES', 'chk_wallet_member_role'],
  ['MEMBER_STATUSES', 'chk_wallet_member_status'],
  ['INVITABLE_ROLES', 'chk_invitation_role'],
  ['WALLET_STATUSES', 'chk_wallet_status'],
  ['ACCOUNT_TYPES', 'chk_account_type'],
  ['ACCOUNT_STATUSES', 'chk_account_status'],
  ['CATEGORY_TYPES', 'chk_category_type'],
  ['CATEGORY_STATUSES', 'chk_category_status'],
  ['TRANSACTION_TYPES', 'chk_transaction_type'],
  ['TRANSACTION_STATUSES', 'chk_transaction_status'],
  ['BUDGET_PERIOD_TYPES', 'chk_budget_period'],
  ['REPEATING_BUDGET_PERIODS', 'chk_budget_end'],
  ['GOAL_STATUSES', 'chk_goal_status'],
  ['AI_MESSAGE_ROLES', 'chk_ai_message_role'],
  ['AI_ACTION_TYPES', 'chk_ai_message_action_type'],
  ['AI_ACTION_STATUSES', 'chk_ai_message_action_status'],
];

for (const [enumName, constraintName] of ENUM_TO_CONSTRAINT) {
  const members = contractMembers(enumName);
  const allowed = constraintValues(constraintName);

  if (members === null) {
    check(`${enumName} is declared in enums.ts`, false, 'tuple not found');
    continue;
  }
  if (allowed === null) {
    check(`${constraintName} is declared in the migration`, false, 'constraint not found');
    continue;
  }

  check(
    `${enumName} matches ${constraintName}`,
    sameSet(members, allowed),
    `contract=[${members}] db=[${allowed}]`,
  );
}

// ---------------------------------------------------------------------------
// 2. Every route is documented in the API specification
// ---------------------------------------------------------------------------

const routePaths = [...ROUTES_TS.matchAll(/=>\s*[`'"]([/][^`'"\s]*)[`'"]/g)]
  .map((m) => m[1])
  .map((path) => path.replace(/\$\{[^}]+\}/g, '{id}'))
  .filter((path) => path.startsWith('/'));

const uniqueRoutes = [...new Set(routePaths)];

for (const route of uniqueRoutes) {
  // The spec writes path parameters as {id}, {memberId}, {invId} and so on, so
  // compare on the static segments only.
  const segments = route.split('/').filter((s) => s.length > 0 && !s.startsWith('{'));
  const documented = segments.every((segment) => API_SPEC.includes(segment));
  check(`route ${route} appears in API_SPECIFICATION.md`, documented);
}

// ---------------------------------------------------------------------------
// 3. Error codes in the contract are all mapped to a status
// ---------------------------------------------------------------------------

const RESPONSES_TS = readFileSync(join(ROOT, 'packages/contracts/src/responses.ts'), 'utf8');
const codeListMatch = RESPONSES_TS.match(/export const ERROR_CODES = \[([^\]]*)\] as const/s);
const statusMapMatch = RESPONSES_TS.match(/export const ERROR_STATUS[^=]*= \{([^}]*)\}/s);

if (codeListMatch && statusMapMatch) {
  const codes = [...codeListMatch[1].matchAll(/'([A-Z_]+)'/g)].map((m) => m[1]);
  // Accepts either a bare number or HTTP_STATUS.NAME — the assertion is that
  // every code has an entry, not what the status is.
  const mapped = [...statusMapMatch[1].matchAll(/([A-Z_]+):\s*(?:\d{3}|HTTP_STATUS\.[A-Z_]+)/g)].map(
    (m) => m[1],
  );
  const unmapped = codes.filter((c) => !mapped.includes(c));
  const orphaned = mapped.filter((c) => !codes.includes(c));

  check('every ERROR_CODE has an ERROR_STATUS', unmapped.length === 0, `missing: ${unmapped}`);
  check('ERROR_STATUS has no unknown codes', orphaned.length === 0, `extra: ${orphaned}`);
} else {
  check('ERROR_CODES and ERROR_STATUS are both declared', false);
}

// ---------------------------------------------------------------------------
// 4. Every constraint the API translates still exists after the last migration
// ---------------------------------------------------------------------------

// A mapping keyed on a dropped name never fires, so its violation reaches the client as a 500.
function liveConstraints() {
  const live = new Set();
  const pattern = /(DROP\s+)?(?:CONSTRAINT|INDEX)\s+(?:IF\s+(?:NOT\s+)?EXISTS\s+)?([a-z][a-z0-9_]*)/gi;
  for (const [, dropped, name] of SCHEMA_SQL.matchAll(pattern)) {
    if (dropped) live.delete(name);
    else live.add(name);
  }
  return live;
}

const PG_ERROR_TS = readFileSync(join(ROOT, 'server/src/common/pg-error.ts'), 'utf8');
const constraintMapMatch = PG_ERROR_TS.match(/const CONSTRAINT_CODES[^=]*= \{([^}]*)\}/s);

if (constraintMapMatch) {
  const live = liveConstraints();
  const mapped = [...constraintMapMatch[1].matchAll(/([a-z][a-z0-9_]*):/g)].map((m) => m[1]);
  const stale = mapped.filter((name) => !live.has(name));
  const unmappedExclusions = [...live].filter((name) => name.startsWith('excl_') && !mapped.includes(name));

  check('every CONSTRAINT_CODES key names a live constraint', stale.length === 0, `dropped or unknown: ${stale}`);
  check('every exclusion constraint maps to an error code', unmappedExclusions.length === 0, `unmapped: ${unmappedExclusions}`);
} else {
  check('CONSTRAINT_CODES is declared in pg-error.ts', false);
}

// ---------------------------------------------------------------------------
// 5. Starter-category translations: the migration's rows mirror STARTER_CATEGORIES
// ---------------------------------------------------------------------------

const STARTER_TS = readFileSync(join(ROOT, 'packages/contracts/src/starter-categories.ts'), 'utf8');
const localesMatch = ENUMS_TS.match(/export const LOCALES = \[([^\]]*)\] as const/);
const locales = localesMatch ? [...localesMatch[1].matchAll(/'([a-z]+)'/g)].map((m) => m[1]).sort() : [];
check('LOCALES is declared in enums.ts', locales.length > 0, 'tuple not found');

for (const constraintName of ['chk_user_locale', 'chk_category_translation_locale']) {
  const match = SCHEMA_SQL.match(new RegExp(`CONSTRAINT\\s+${constraintName}\\s*\\n?\\s*CHECK\\s*\\(([^;]*?)\\)\\s*(?:,|\\n\\s*\\)|;)`, 's'));
  const allowed = match ? [...match[1].matchAll(/'([a-z]+)'/g)].map((m) => m[1]).sort() : null;
  check(`LOCALES matches ${constraintName}`, sameSet(locales, allowed), `contract=[${locales}] db=[${allowed}]`);
}

// Rows as `key|locale|name`. Neither side may hold an apostrophe in a name, which keeps both parsers trivial.
const contractTranslations = [...STARTER_TS.matchAll(/key: '([a-z_]+)', names: \{([^}]*)\}/g)].flatMap(([, key, names]) =>
  [...names.matchAll(/([a-z]+): '([^']*)'/g)].map(([, locale, name]) => `${key}|${locale}|${name}`),
);
const insertMatch = SCHEMA_SQL.match(/INSERT INTO category_translations \(system_key, locale, name\) VALUES([^;]*);/);
const schemaTranslations = insertMatch
  ? [...insertMatch[1].matchAll(/\('([a-z_]+)', '([a-z]+)', '([^']*)'\)/g)].map(([, key, locale, name]) => `${key}|${locale}|${name}`)
  : null;

check('category_translations rows are inserted in the migration', schemaTranslations !== null, 'INSERT not found');
if (schemaTranslations !== null) {
  const inSchema = new Set(schemaTranslations);
  const inContract = new Set(contractTranslations);
  const missing = contractTranslations.filter((row) => !inSchema.has(row));
  const extra = schemaTranslations.filter((row) => !inContract.has(row));
  check('every STARTER_CATEGORIES name has a matching category_translations row', missing.length === 0, missing.join(', '));
  check('every category_translations row matches a STARTER_CATEGORIES name', extra.length === 0, extra.join(', '));

  const keys = [...new Set(contractTranslations.map((row) => row.split('|')[0]))];
  const untranslated = keys.flatMap((key) =>
    locales.filter((locale) => !contractTranslations.some((row) => row.startsWith(`${key}|${locale}|`))).map((locale) => `${key}/${locale}`),
  );
  check('every starter category is named in every locale', untranslated.length === 0, untranslated.join(', '));
}

// ---------------------------------------------------------------------------
// Report
// ---------------------------------------------------------------------------

const passed = checks.filter((c) => c.ok).length;

for (const { label, ok } of checks) {
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${label}`);
}

console.log(`\n${passed}/${checks.length} parity checks passed`);

if (failures.length > 0) {
  console.error('\nFailures:');
  for (const failure of failures) console.error(`  - ${failure}`);
  process.exit(1);
}
