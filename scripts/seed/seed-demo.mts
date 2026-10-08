// Realistic demo data through the public API (plans/tooling/seed-data-plan.md). Point it only at an API
// running on a database created for it: it adds users and never cleans up.
//
//   node scripts/seed/seed-demo.mts --dry-run                 build and check the ledger, no API call
//   SEED_API_URL=http://127.0.0.1:3417 node scripts/seed/seed-demo.mts
//   … --guest-fixture demo-guest.json                         also write An's wallet as guest-mode data
//
// SEED (default 2) and SEED_ANCHOR (default: today in Asia/Ho_Chi_Minh) fix the data. SEED_RATES_URL, the
// URL of a running rates-stub.mts the API reads rates from, adds the exchange-rate check.

import { randomBytes } from 'node:crypto';
import { mkdirSync, writeFileSync } from 'node:fs';

import { seedAiConversation } from './ai.ts';
import { AnchorError, resolveAnchor } from './calendar.ts';
import { SeedApi } from './client.ts';
import { rowsOfWallet, storyChecks } from './figures.ts';
import { buildLedger } from './generators/index.ts';
import { writeGuestFixture } from './guest-fixture.ts';
import { LedgerError, formatAmount } from './ledger.ts';
import { ACCOUNTS, PERSONA_KEYS, WALLETS, type WalletKey } from './personas.ts';
import { Seeder } from './post.ts';
import { checkRates } from './rates.ts';
import { Verifier, ledgerDigest } from './verify.ts';

const ROOT = new URL('../../', import.meta.url);
const args = process.argv.slice(2);
const dryRun = args.includes('--dry-run');
const fixtureIndex = args.indexOf('--guest-fixture');
const fixtureFile = fixtureIndex >= 0 ? args[fixtureIndex + 1] : undefined;

function fail(message: string, code = 1): never {
  console.error(`\n${message}`);
  process.exit(code);
}

const seed = Number(process.env.SEED ?? 2);
if (!Number.isInteger(seed)) fail(`SEED must be an integer, got "${process.env.SEED}"`, 2);

let built: ReturnType<typeof buildLedger>;
try {
  built = buildLedger(seed, resolveAnchor(process.env.SEED_ANCHOR));
} catch (error) {
  if (error instanceof AnchorError || error instanceof LedgerError) fail(`Can't build the ledger: ${error.message}`, 2);
  throw error;
}
const { ledger, dates } = built;
const digest = ledgerDigest(ledger);

console.log(`SEED ${seed}, anchor ${dates.anchor}: history ${dates.historyStart} … ${dates.historyEnd}, Tet ${dates.tet}, ledger ${digest}`);
console.log(`rows per wallet: ${(Object.keys(WALLETS) as WalletKey[]).map((wallet) => `${wallet} ${rowsOfWallet(ledger, wallet).length}`).join(', ')}; ${ledger.rows.length} rows, ${ledger.contributions.length} contributions`);
console.log(`balances: ${Object.values(ACCOUNTS).map((account) => `${account.key} ${formatAmount(ledger.balances[account.key], account.currency)}`).join(', ')}`);
const checks = storyChecks(ledger, dates);
for (const check of checks) console.log(`  ${check.ok ? '✓' : check.hard ? '✗' : '~'} ${check.name}${check.detail ? `: ${check.detail}` : ''}`);
const missed = checks.filter((check) => check.hard && !check.ok);
const soft = checks.filter((check) => !check.hard && !check.ok);
if (soft.length) console.log(`${soft.length} typical-period claim(s) don't hold for this SEED and anchor (~), which the story tolerates.`);
if (missed.length) fail(`The ledger misses ${missed.length} required state(s): ${missed.map((check) => check.name).join('; ')}. Try another SEED or anchor.`);

if (fixtureFile) {
  const written = writeGuestFixture(fixtureFile, ledger, dates, seed);
  console.log(`guest fixture: ${fixtureFile} (${written.transactions} transactions)`);
}
if (dryRun) process.exit(0);

// ---- Guard (plan §1.3)
const apiUrl = process.env.SEED_API_URL;
if (!apiUrl) fail('SEED_API_URL is required (scheme://host:port, no /api/v1); there is no default, so this never seeds a server by accident.', 2);
const host = new URL(apiUrl).hostname;
if (!['localhost', '127.0.0.1', '::1', '[::1]'].includes(host) && process.env.SEED_ALLOW_REMOTE !== 'yes') {
  fail(`${host} isn't loopback. Fake users in a shared database are damage; set SEED_ALLOW_REMOTE=yes only for a database created for this.`, 2);
}
const api = new SeedApi(apiUrl);
const health = await api.raw('GET', '/health');
if (health.status !== 200) fail(`${api.apiBase}/health answered ${health.status}`, 2);

const runId = randomBytes(4).toString('hex');
const seeder = new Seeder(api, ledger, dates, runId, seed);
mkdirSync(new URL('.seed/', ROOT), { recursive: true });

function writeOutputs(): void {
  const lines = [
    `SEED_API_BASE=${api.apiBase}`,
    `SEED=${seed}`,
    `SEED_ANCHOR=${dates.anchor}`,
    `SEED_RUN_ID=${runId}`,
    ...PERSONA_KEYS.filter((persona) => seeder.sessions[persona]).flatMap((persona) => [
      `SEED_${persona.toUpperCase()}_EMAIL=${seeder.sessions[persona].email}`,
      `SEED_${persona.toUpperCase()}_PASSWORD=${seeder.sessions[persona].password}`,
    ]),
    ...(Object.entries(seeder.ids.wallets) as [string, string][]).map(([wallet, id]) => `SEED_WALLET_${wallet.toUpperCase()}=${id}`),
    ...(seeder.ids.sisterInvitation ? [`SEED_SISTER_INVITATION_TOKEN=${seeder.ids.sisterInvitation.token}`] : []),
  ];
  writeFileSync(new URL('.env.seed', ROOT), `${lines.join('\n')}\n`);
  const { sisterInvitation, ...ids } = seeder.ids;
  writeFileSync(new URL(`.seed/${runId}.json`, ROOT), `${JSON.stringify({ ...ids, digest, sisterInvitation: sisterInvitation && { id: sisterInvitation.id, email: sisterInvitation.email } }, null, 2)}\n`);
}

const started = Date.now();
const phase = async <T,>(name: string, run: () => Promise<T>): Promise<T> => {
  const at = Date.now();
  const before = api.requests;
  const result = await run();
  console.log(`${name}: ${((Date.now() - at) / 1000).toFixed(1)} s, ${api.requests - before} requests`);
  return result;
};

console.log(`\nSeeding ${api.apiBase} as run ${runId}`);
try {
  await phase('1 personas, wallets, memberships', () => seeder.registerPersonas());
  writeOutputs();
  await phase('2 accounts, categories, goals', () => seeder.setUpWallets());
  const verifier = new Verifier(api, seeder, ledger, dates);
  const posted = await phase('3–4 transactions', () => seeder.postTransactions());
  console.log(`  ${posted} transactions posted`);
  await phase('  balances as first entered', () => verifier.balances(Verifier.postedBalances(ledger), 'item 1 before corrections'));
  await phase('5 contributions, budgets', async () => {
    await seeder.postContributions();
    await seeder.postBudgets();
  });
  await phase('6 corrections, state changes', async () => {
    console.log(`  ${await seeder.applyCorrections()} corrections`);
    await seeder.applyStateChanges();
  });
  await phase('7 AI conversation', () => seedAiConversation(api, seeder, ledger));
  await phase('verify (§7)', () => verifier.all());
  const ratesUrl = process.env.SEED_RATES_URL;
  if (ratesUrl) await phase('8 exchange rates', () => checkRates(api, seeder, ledger, ratesUrl.replace(/\/+$/, '')));
  else console.log('8 exchange rates: skipped (set SEED_RATES_URL to a running rates-stub.mts)');
} finally {
  writeOutputs();
}

console.log(`\nDone in ${((Date.now() - started) / 1000).toFixed(1)} s, ${api.requests} requests. Credentials in .env.seed, ids in .seed/${runId}.json.`);
console.log(`Sign in as ${seeder.sessions.an.email} (An); the others are in .env.seed.`);
