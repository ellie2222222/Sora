import { strict as assert } from 'node:assert';
import { describe, it } from 'node:test';

import { buildEntityAdapters, type AdapterApis } from './entityAdapters.ts';

interface Call {
  api: string;
  args: unknown[];
}

/** Every api method records its arguments and resolves like the real one would. */
function recordingApis(): { apis: AdapterApis; calls: Call[] } {
  const calls: Call[] = [];
  const method =
    (api: string, result: unknown = undefined) =>
    async (...args: unknown[]) => {
      calls.push({ api, args });
      return result;
    };

  const apis = {
    transactions: { create: method('transactions.create', { id: 'srv-tx' }), update: method('transactions.update'), delete: method('transactions.delete') },
    accounts: { create: method('accounts.create', { id: 'srv-acc' }), update: method('accounts.update'), archive: method('accounts.archive') },
    budgets: { create: method('budgets.create', { id: 'srv-bud' }), update: method('budgets.update'), archive: method('budgets.archive') },
    goals: { create: method('goals.create', { id: 'srv-goal' }), update: method('goals.update'), cancel: method('goals.cancel'), addContribution: method('goals.addContribution', { id: 'srv-con' }) },
    categories: {
      create: method('categories.create', { id: 'srv-cat' }),
      update: method('categories.update'),
      archive: method('categories.archive'),
      deletePermanently: method('categories.deletePermanently'),
    },
  } as unknown as AdapterApis;

  return { apis, calls };
}

describe('buildEntityAdapters — contribution', () => {
  it('moves goalId into the URL argument and strips it from the body', async () => {
    const { apis, calls } = recordingApis();
    const adapters = buildEntityAdapters(apis);

    const created = await adapters.contribution.create(
      { goalId: 'goal-1', accountId: 'acc-1', amount: '50000', contributionDate: '2026-09-25' },
      'key-1',
    );

    assert.deepEqual(created, { id: 'srv-con' });
    assert.deepEqual(calls, [
      {
        api: 'goals.addContribution',
        args: ['goal-1', { accountId: 'acc-1', amount: '50000', contributionDate: '2026-09-25' }, 'key-1'],
      },
    ]);
  });

  it('refuses the ops a contribution never queues, with a message naming the reason', async () => {
    const adapters = buildEntityAdapters(recordingApis().apis);

    await assert.rejects(adapters.contribution.update('c-1', {}, 'k'), {
      message: 'entityAdapters: contributions are never edited',
    });
    await assert.rejects(adapters.contribution.cancelOrArchive('c-1', {}, 'k'), {
      message: 'entityAdapters: contribution removal is not queued offline',
    });
    assert.equal(adapters.contribution.deletePermanently, undefined);
  });
});

describe('buildEntityAdapters — transaction', () => {
  it('passes the cancel reason and idempotency key to the delete call', async () => {
    const { apis, calls } = recordingApis();

    await buildEntityAdapters(apis).transaction.cancelOrArchive('tx-1', { reason: 'Entered twice' }, 'key-2');

    assert.deepEqual(calls, [{ api: 'transactions.delete', args: ['tx-1', 'Entered twice', 'key-2'] }]);
  });

  it('cancels without a reason when the queued payload carries none', async () => {
    const { apis, calls } = recordingApis();

    await buildEntityAdapters(apis).transaction.cancelOrArchive('tx-1', undefined, 'key-3');

    assert.deepEqual(calls, [{ api: 'transactions.delete', args: ['tx-1', undefined, 'key-3'] }]);
  });

  it('forwards the idempotency key on create and update, and returns the server id', async () => {
    const { apis, calls } = recordingApis();
    const adapters = buildEntityAdapters(apis);
    const body = { type: 'EXPENSE', amount: '1000' };

    assert.deepEqual(await adapters.transaction.create(body, 'key-c'), { id: 'srv-tx' });
    await adapters.transaction.update('tx-9', { description: 'Lunch' }, 'key-u');

    assert.deepEqual(calls, [
      { api: 'transactions.create', args: [body, 'key-c'] },
      { api: 'transactions.update', args: ['tx-9', { description: 'Lunch' }, 'key-u'] },
    ]);
  });
});

describe('buildEntityAdapters — archive-style entities', () => {
  it('routes cancelOrArchive to archive for accounts, budgets and categories and to cancel for goals', async () => {
    const { apis, calls } = recordingApis();
    const adapters = buildEntityAdapters(apis);

    await adapters.account.cancelOrArchive('a-1', { ignored: true }, 'k-a');
    await adapters.budget.cancelOrArchive('b-1', undefined, 'k-b');
    await adapters.category.cancelOrArchive('c-1', undefined, 'k-c');
    await adapters.goal.cancelOrArchive('g-1', undefined, 'k-g');

    assert.deepEqual(calls, [
      { api: 'accounts.archive', args: ['a-1', 'k-a'] },
      { api: 'budgets.archive', args: ['b-1', 'k-b'] },
      { api: 'categories.archive', args: ['c-1', 'k-c'] },
      { api: 'goals.cancel', args: ['g-1', 'k-g'] },
    ]);
  });

  it('offers a permanent delete only for categories', async () => {
    const { apis, calls } = recordingApis();
    const adapters = buildEntityAdapters(apis);

    await adapters.category.deletePermanently?.('c-1', 'k-d');

    assert.deepEqual(calls, [{ api: 'categories.deletePermanently', args: ['c-1', 'k-d'] }]);
    for (const entity of ['transaction', 'account', 'budget', 'goal'] as const) {
      assert.equal(adapters[entity].deletePermanently, undefined, entity);
    }
  });

  it('forwards a queued goal edit to goals.update with its idempotency key', async () => {
    const { apis, calls } = recordingApis();

    await buildEntityAdapters(apis).goal.update('g-1', { name: 'Trip' }, 'k-u');

    assert.deepEqual(calls, [{ api: 'goals.update', args: ['g-1', { name: 'Trip' }, 'k-u'] }]);
  });
});
