// Never cleaned up: point E2E_API_URL only at a disposable stack. Users are probe+e2e-<uuid>@example.invalid,
// removable by exact email. Usage: E2E_API_URL=http://127.0.0.1:3000 node mobile/e2e/seed.mts [out.env]

import { appendFileSync } from 'node:fs';

import { API_PREFIX } from '@sora/contracts';

import { categoryOf, createAccount, nowIso, registerProbeUser, type ApiCaller } from '../../server/test/support/probe-data.ts';

const baseUrl = process.env.E2E_API_URL;
if (!baseUrl) {
  console.error('E2E_API_URL is required; there is no default, so this can never seed a server by accident.');
  process.exit(2);
}

const api: ApiCaller = {
  async call(method, path, options = {}) {
    const response = await fetch(`${baseUrl}${API_PREFIX}${path}`, {
      method,
      headers: {
        ...(options.body === undefined ? {} : { 'content-type': 'application/json' }),
        ...(options.token ? { authorization: `Bearer ${options.token}` } : {}),
        ...options.headers,
      },
      body: options.body === undefined ? undefined : JSON.stringify(options.body),
    });
    const raw = await response.text();
    return { status: response.status, headers: Object.fromEntries(response.headers), body: raw ? JSON.parse(raw) : null };
  },
};

const user = await registerProbeUser(api, 'e2e');
const accountId = await createAccount(api, user, user.walletId, { name: 'E2E Cash', initialBalance: '1000000' });
const expense = await api.call('POST', '/transactions', {
  token: user.token,
  body: {
    type: 'EXPENSE',
    fromAccountId: accountId,
    categoryId: await categoryOf(api, user, user.walletId, 'EXPENSE'),
    amount: '45000',
    currency: 'VND',
    transactionDate: nowIso(),
    description: 'E2E seeded expense',
  },
});
if (expense.status !== 201) throw new Error(`expense create failed: ${expense.status} ${JSON.stringify(expense.body)}`);

// E2E_API_BASE carries API_PREFIX so the Maestro scripts, which cannot import it, never restate it.
const lines = `E2E_API_BASE=${baseUrl}${API_PREFIX}\nE2E_EMAIL=${user.email}\nE2E_PASSWORD=${user.password}\nE2E_WALLET_ID=${user.walletId}\n`;
const outFile = process.argv[2];
if (outFile) appendFileSync(outFile, lines);
else process.stdout.write(lines);
