#!/usr/bin/env node
/**
 * Asserts the shared contract and the database schema agree.
 *
 * Three things can drift apart silently, and each drift shows up as a 500 from
 * Postgres rather than a validation error, which is the worst possible place to
 * discover it:
 *
 *   1. An enum member in packages/contracts/src/enums.ts that no CHECK constraint
 *      allows -- the API accepts the value and the INSERT then fails.
 *   2. A CHECK constraint value the contract does not know about -- a legal state
 *      the app can never produce or display.
 *   3. A route in routes.ts that the API specification does not document.
 *
 * Reads the migration SQL as text rather than querying a live database, so this
 * runs in CI with no services.
 *
 * Usage: node scripts/check-contract-parity.mjs
 */

import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');

const SCHEMA_SQL = readFileSync(join(ROOT, 'db/migrations/001_initial_wallet_schema.sql'), 'utf8');
const ENUMS_TS = readFileSync(join(ROOT, 'packages/contracts/src/enums.ts'), 'utf8');
const ROUTES_TS = readFileSync(join(ROOT, 'packages/contracts/src/routes.ts'), 'utf8');
const API_SPEC = readFileSync(join(ROOT, 'docs/API_SPECIFICATION.md'), 'utf8');

const failures = [];
const checks = [];

function check(label, ok, detail = '') {
  checks.push({ label, ok });
  if (!ok) failures.push(`${label}${detail ? ` — ${detail}` : ''}`);
}

/** Values a named CHECK constraint admits, read out of its IN (...) list. */
function constraintValues(constraintName) {
  const pattern = new RegExp(
    `CONSTRAINT\\s+${constraintName}\\s*\\n?\\s*CHECK\\s*\\(([^;]*?)\\)\\s*(?:,|\\n\\s*\\))`,
    's',
  );
  const match = SCHEMA_SQL.match(pattern);
  if (!match) return null;
  const values = [...match[1].matchAll(/'([A-Z_]+)'/g)].map((m) => m[1]);
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
  ['BUDGET_STATUSES', 'chk_budget_status'],
  ['GOAL_STATUSES', 'chk_goal_status'],
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

const routePaths = [...ROUTES_TS.matchAll(/=>\s*`?([/][^`'\s]*)`?/g)]
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
  const mapped = [...statusMapMatch[1].matchAll(/([A-Z_]+):\s*\d{3}/g)].map((m) => m[1]);
  const unmapped = codes.filter((c) => !mapped.includes(c));
  const orphaned = mapped.filter((c) => !codes.includes(c));

  check('every ERROR_CODE has an ERROR_STATUS', unmapped.length === 0, `missing: ${unmapped}`);
  check('ERROR_STATUS has no unknown codes', orphaned.length === 0, `extra: ${orphaned}`);
} else {
  check('ERROR_CODES and ERROR_STATUS are both declared', false);
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
