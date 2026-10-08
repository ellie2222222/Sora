// Phase 9's upload proof: a guest fixture (seed-demo.mts --guest-fixture) goes through the app's own
// guest → account upload (mobile/src/services/guest/guestUpload.ts) into a fresh user on a running API,
// and every uploaded account's balance and goal's progress must match what the fixture says.
//   SEED_API_URL=http://127.0.0.1:3419 node scripts/seed/guest-upload-check.mts demo-guest.json

import { randomBytes } from 'node:crypto';
import { readFileSync } from 'node:fs';

import { formatMoney, parseMoney, type AccountResponse, type AuthResponse, type GoalResponse, type WalletResponse } from '@sora/contracts';

import { SeedApi, type Session } from './client.ts';

const [file] = process.argv.slice(2);
const apiUrl = process.env.SEED_API_URL;
if (!file || !apiUrl) {
  console.error('Usage: SEED_API_URL=… node scripts/seed/guest-upload-check.mts <fixture.json>');
  process.exit(2);
}
const fixture = JSON.parse(readFileSync(file, 'utf8'));
const api = new SeedApi(apiUrl);

// Loaded by URL so this script's typecheck doesn't pull the app's module graph in.
const guestDir = new URL('../../mobile/src/services/guest/', import.meta.url);
const { guestStore } = await import(new URL('guestStorage.ts', guestDir).href);
const { uploadGuestData } = await import(new URL('guestUpload.ts', guestDir).href);

const runId = randomBytes(4).toString('hex');
const email = `seed+guest-${runId}@example.invalid`;
const password = randomBytes(18).toString('base64url');
const auth = await api.call<AuthResponse>('POST', '/auth/register', {
  body: { email, password, displayName: 'Guest', locale: 'vi', timeZone: fixture.wallet.timeZone },
  expect: [201],
});
const session: Session = { persona: 'an', userId: auth.user.id, email, password, locale: 'vi', accessToken: auth.tokens.accessToken, refreshToken: auth.tokens.refreshToken };
const walletId = (await api.call<WalletResponse[]>('GET', '/wallets', { session })).find((wallet) => wallet.isOwn)!.id;

let saved: string | null = JSON.stringify(fixture);
guestStore.setPersistence({ load: async () => saved, save: async (value: string) => void (saved = value), clear: async () => void (saved = null) });
await guestStore.hydrate();

const create = (path: string) => (body: unknown, idempotencyKey?: string) => api.call('POST', path, { session, body, idempotencyKey, expect: [201] });
const apis = {
  categories: {
    list: (query: { walletId: string }) => api.all(`/categories?walletId=${query.walletId}`, session),
    create: create('/categories'),
    archive: (id: string, idempotencyKey?: string) => api.call('DELETE', `/categories/${id}`, { session, idempotencyKey }),
  },
  accounts: {
    create: create('/accounts'),
    archive: (id: string, idempotencyKey?: string) => api.call('DELETE', `/accounts/${id}`, { session, idempotencyKey }),
  },
  transactions: { create: create('/transactions') },
  budgets: { create: create('/budgets') },
  goals: {
    create: create('/goals'),
    addContribution: (goalId: string, body: unknown, idempotencyKey?: string) => api.call('POST', `/goals/${goalId}/contributions`, { session, body, idempotencyKey, expect: [201] }),
    cancel: (goalId: string, idempotencyKey?: string) => api.call('DELETE', `/goals/${goalId}`, { session, idempotencyKey }),
    update: (goalId: string, body: unknown, idempotencyKey?: string) => api.call('PATCH', `/goals/${goalId}`, { session, body, idempotencyKey }),
  },
};

const started = Date.now();
await uploadGuestData(walletId, apis);
const progress = guestStore.current().uploadProgress;
console.log(`uploaded ${fixture.transactions.length} transactions as ${email} in ${((Date.now() - started) / 1000).toFixed(1)} s, ${api.requests} requests`);

// What the fixture itself says each account holds and each goal has saved.
const expected = new Map<string, bigint>(fixture.accounts.map((account: { id: string; initialBalance: string }) => [account.id, parseMoney(account.initialBalance)]));
for (const row of fixture.transactions) {
  if (row.status !== 'COMPLETED') continue;
  if (row.fromAccountId) expected.set(row.fromAccountId, expected.get(row.fromAccountId)! - parseMoney(row.amount));
  if (row.toAccountId) expected.set(row.toAccountId, expected.get(row.toAccountId)! + parseMoney(row.amount));
}
const failures: string[] = [];
const accounts = await api.all<AccountResponse>(`/accounts?walletId=${walletId}&status=ACTIVE`, session);
const archived = await api.all<AccountResponse>(`/accounts?walletId=${walletId}&status=ARCHIVED`, session);
for (const account of fixture.accounts) {
  const uploaded = [...accounts, ...archived].find((candidate) => candidate.id === progress.accountMap[account.id]);
  const want = formatMoney(expected.get(account.id)!);
  if (uploaded?.balance !== want) failures.push(`${account.name}: ${uploaded?.balance} on the server, ${want} in the fixture`);
}
const goals = await api.all<GoalResponse>(`/goals?walletId=${walletId}`, session);
for (const goal of fixture.goals) {
  const saved = fixture.contributions.filter((entry: { goalId: string }) => entry.goalId === goal.id).reduce((sum: bigint, entry: { amount: string }) => sum + parseMoney(entry.amount), 0n);
  const uploaded = goals.find((candidate) => candidate.id === progress.goalMap[goal.id]);
  if (uploaded?.currentAmount !== formatMoney(saved) || uploaded.status !== goal.status) {
    failures.push(`${goal.name}: ${uploaded?.currentAmount} ${uploaded?.status} on the server, ${formatMoney(saved)} ${goal.status} in the fixture`);
  }
}
const total = (await api.raw('GET', `/transactions?walletId=${walletId}&pageSize=1`, { session })).body?.meta?.pagination?.total;
if (total !== fixture.transactions.length) failures.push(`${total} transactions on the server, ${fixture.transactions.length} in the fixture`);

if (failures.length) {
  for (const failure of failures) console.log(`  ✗ ${failure}`);
  process.exit(1);
}
console.log(`  ✓ ${fixture.accounts.length} account balances, ${fixture.goals.length} goals and the transaction count match the fixture`);
