import { strict as assert } from 'node:assert';
import { randomUUID } from 'node:crypto';
import { after, before, describe, it } from 'node:test';

import { categoryOf, createAccount, integrationSkipReason, registerProbeUser, startTestApi, type ProbeUser, type TestApi } from './support/integration.ts';

const IN_WINDOW = '2026-06-15T09:00:00.000Z';
const WINDOW = { startDate: '2026-06-01', endDate: '2026-06-30' };

/** BR-04 budgets and goal contributions over HTTP, with the derived figures read back (BR-05). */
describe('budgets and goals against a real database', { skip: integrationSkipReason() }, () => {
  let api: TestApi;
  let user: ProbeUser;
  let vnd = '';
  let food = '';

  const budget = (body: Record<string, unknown>) =>
    api.call('POST', '/budgets', {
      token: user.token,
      body: { walletId: user.walletId, categoryId: food, name: `probe-${randomUUID()}`, amount: '1000', currency: 'VND', periodType: 'CUSTOM', ...WINDOW, ...body },
    });
  const expense = (body: Record<string, unknown>) =>
    api.call('POST', '/transactions', {
      token: user.token,
      body: { type: 'EXPENSE', fromAccountId: vnd, categoryId: food, currency: 'VND', transactionDate: IN_WINDOW, ...body },
    });

  before(async () => {
    api = await startTestApi();
    user = await registerProbeUser(api, 'planning');
    vnd = await createAccount(api, user, user.walletId, { initialBalance: '100000' });
    food = await categoryOf(api, user, user.walletId, 'EXPENSE');
  });

  after(async () => {
    await api?.close();
  });

  it('derives spent from the window\'s completed expenses, including ones recorded before the budget existed', async () => {
    await expense({ amount: '400' });
    await expense({ amount: '50', transactionDate: '2026-05-31T23:00:00.000Z' });
    const created = await budget({ amount: '300' });
    assert.equal(created.status, 201);
    assert.deepEqual(
      [created.body!.data.spent, created.body!.data.remaining, created.body!.data.isOverBudget],
      ['400.0000', '-100.0000', true],
      'remaining goes negative rather than hiding an overspend',
    );
  });

  it('refuses an overlapping active budget for the same category, and allows it once the first is archived (BR-04)', async () => {
    const category = await categoryOf(api, user, user.walletId, 'EXPENSE');
    const other = (await api.call('GET', `/categories?walletId=${user.walletId}&type=EXPENSE&pageSize=200`, { token: user.token })).body!.data.find(
      (candidate: { id: string }) => candidate.id !== category,
    ).id as string;
    const first = await budget({ categoryId: other, startDate: '2026-08-01', endDate: '2026-08-31' });
    assert.equal(first.status, 201);

    const overlapping = await budget({ categoryId: other, startDate: '2026-08-31', endDate: '2026-09-30' });
    assert.deepEqual([overlapping.status, overlapping.body?.error?.code], [409, 'BUDGET_PERIOD_OVERLAP'], 'sharing only the last day still overlaps');

    await api.call('DELETE', `/budgets/${first.body!.data.id}`, { token: user.token });
    const afterArchive = await budget({ categoryId: other, startDate: '2026-08-31', endDate: '2026-09-30' });
    assert.equal(afterArchive.status, 201);
  });

  it('counts only expenses in the budget\'s own currency toward spent (BR-07)', async () => {
    const usd = await createAccount(api, user, user.walletId, { currency: 'USD', initialBalance: '100' });
    const category = (await api.call('GET', `/categories?walletId=${user.walletId}&type=EXPENSE&pageSize=200`, { token: user.token })).body!.data.at(-1).id as string;
    await api.call('POST', '/transactions', {
      token: user.token,
      body: { type: 'EXPENSE', fromAccountId: usd, categoryId: category, amount: '20', currency: 'USD', transactionDate: IN_WINDOW },
    });
    const created = await budget({ categoryId: category, amount: '1000' });
    assert.equal(created.body!.data.spent, '0.0000', 'a USD expense must not consume a VND budget');
  });

  it('records a contribution as an EXPENSE in one write: the account pays, the goal advances, a budget counts it', async () => {
    const category = await categoryOf(api, user, user.walletId, 'EXPENSE');
    const goal = await api.call('POST', '/goals', { token: user.token, body: { walletId: user.walletId, name: `probe-${randomUUID()}`, targetAmount: '1000', currency: 'VND' } });
    const goalId = goal.body!.data.id as string;
    const account = await createAccount(api, user, user.walletId, { initialBalance: '5000' });

    const contribution = await api.call('POST', `/goals/${goalId}/contributions`, {
      token: user.token,
      body: { accountId: account, amount: '250', currency: 'VND', contributionDate: IN_WINDOW, recordAsTransaction: true, categoryId: category },
    });
    assert.equal(contribution.status, 201);
    const transactionId = contribution.body!.data.transactionId as string;
    assert.ok(transactionId);

    const [backing] = await api.sql<{ type: string; status: string; amount: string }>('SELECT type, status, amount::text FROM transactions WHERE id = $1', [transactionId]);
    assert.deepEqual(backing, { type: 'EXPENSE', status: 'COMPLETED', amount: '250.0000' });
    assert.equal((await api.call('GET', `/accounts/${account}`, { token: user.token })).body!.data.balance, '4750.0000');
    const advanced = (await api.call('GET', `/goals/${goalId}`, { token: user.token })).body!.data;
    assert.deepEqual([advanced.currentAmount, advanced.progressPercentage, advanced.contributionCount], ['250.0000', 25, 1]);

    const removed = await api.call('DELETE', `/goals/${goalId}/contributions/${contribution.body!.data.id}`, { token: user.token });
    assert.ok(removed.status === 200 || removed.status === 204, `remove returned ${removed.status}`);
    const [afterRemove] = await api.sql<{ status: string }>('SELECT status FROM transactions WHERE id = $1', [transactionId]);
    assert.equal(afterRemove?.status, 'DELETED', 'the backing transaction is marked, never removed');
    assert.equal((await api.call('GET', `/accounts/${account}`, { token: user.token })).body!.data.balance, '5000.0000');
  });

  it('refuses to record a contribution against an archived account', async () => {
    const category = await categoryOf(api, user, user.walletId, 'EXPENSE');
    const goal = await api.call('POST', '/goals', { token: user.token, body: { walletId: user.walletId, name: `probe-${randomUUID()}`, targetAmount: '1000', currency: 'VND' } });
    const account = await createAccount(api, user, user.walletId, { initialBalance: '5000' });
    const archived = await api.call('DELETE', `/accounts/${account}`, { token: user.token });
    assert.ok(archived.status === 200 || archived.status === 204, `archive returned ${archived.status}`);

    const contribution = await api.call('POST', `/goals/${goal.body!.data.id}/contributions`, {
      token: user.token,
      body: { accountId: account, amount: '10', currency: 'VND', contributionDate: IN_WINDOW, recordAsTransaction: true, categoryId: category },
    });
    assert.deepEqual([contribution.status, contribution.body?.error?.code], [409, 'ACCOUNT_ARCHIVED'], 'an archived account accepts no new entries, however they arrive');
  });

  it('refuses a transaction-backed contribution without a category', async () => {
    const goal = await api.call('POST', '/goals', { token: user.token, body: { walletId: user.walletId, name: `probe-${randomUUID()}`, targetAmount: '1000', currency: 'VND' } });
    const contribution = await api.call('POST', `/goals/${goal.body!.data.id}/contributions`, {
      token: user.token,
      body: { accountId: vnd, amount: '10', currency: 'VND', contributionDate: IN_WINDOW, recordAsTransaction: true },
    });
    assert.equal(contribution.status, 422);
    assert.ok(contribution.body?.error?.fields?.categoryId);
  });
});
