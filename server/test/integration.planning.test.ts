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
    // 23:00 on May 31 in the probe wallet's Asia/Ho_Chi_Minh: the day before the window.
    await expense({ amount: '50', transactionDate: '2026-05-31T16:00:00.000Z' });
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
    const afterDelete = await budget({ categoryId: other, startDate: '2026-08-31', endDate: '2026-09-30' });
    assert.equal(afterDelete.status, 201);
  });

  it('BUD-US-01: refuses an overlapping wallet-wide budget with 409, while a category budget on the same days is allowed', async () => {
    const days = { startDate: '2026-09-01', endDate: '2026-09-30' };
    const first = await budget({ categoryId: null, ...days });
    assert.equal(first.status, 201);
    assert.deepEqual([first.body!.data.categoryId, first.body!.data.goalId], [null, null]);

    const overlapping = await budget({ categoryId: null, startDate: '2026-09-30', endDate: '2026-09-30' });
    assert.deepEqual([overlapping.status, overlapping.body?.error?.code], [409, 'BUDGET_PERIOD_OVERLAP']);

    const categoryBudget = await budget({ ...days });
    assert.equal(categoryBudget.status, 201, 'a category budget is a different kind and has its own overlap rule');
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
    assert.equal(removed.status, 204, 'remove answers 204 No Content (API spec)');
    const [afterRemove] = await api.sql<{ status: string }>('SELECT status FROM transactions WHERE id = $1', [transactionId]);
    assert.equal(afterRemove?.status, 'DELETED', 'the backing transaction is marked, never removed');
    assert.equal((await api.call('GET', `/accounts/${account}`, { token: user.token })).body!.data.balance, '5000.0000');
  });

  it('refuses to record a contribution against an archived account', async () => {
    const category = await categoryOf(api, user, user.walletId, 'EXPENSE');
    const goal = await api.call('POST', '/goals', { token: user.token, body: { walletId: user.walletId, name: `probe-${randomUUID()}`, targetAmount: '1000', currency: 'VND' } });
    const account = await createAccount(api, user, user.walletId, { initialBalance: '5000' });
    const archived = await api.call('DELETE', `/accounts/${account}`, { token: user.token });
    assert.equal(archived.status, 204, 'archive answers 204 No Content (API spec)');

    const contribution = await api.call('POST', `/goals/${goal.body!.data.id}/contributions`, {
      token: user.token,
      body: { accountId: account, amount: '10', currency: 'VND', contributionDate: IN_WINDOW, recordAsTransaction: true, categoryId: category },
    });
    assert.deepEqual([contribution.status, contribution.body?.error?.code], [409, 'ACCOUNT_ARCHIVED'], 'an archived account accepts no new entries, however they arrive');
  });

  it('SAV-US-06: keeps the contributions of a completed or cancelled goal and refuses new ones', async () => {
    for (const close of ['complete', 'cancel'] as const) {
      const goal = await api.call('POST', '/goals', { token: user.token, body: { walletId: user.walletId, name: `probe-${randomUUID()}`, targetAmount: '1000', currency: 'VND' } });
      const goalId = goal.body!.data.id as string;
      const contribute = () =>
        api.call('POST', `/goals/${goalId}/contributions`, {
          token: user.token,
          body: { accountId: vnd, amount: '100', currency: 'VND', contributionDate: IN_WINDOW },
        });
      assert.equal((await contribute()).status, 201);

      const closed =
        close === 'complete'
          ? await api.call('PATCH', `/goals/${goalId}`, { token: user.token, body: { status: 'COMPLETED' } })
          : await api.call('DELETE', `/goals/${goalId}`, { token: user.token });
      assert.equal(closed.status, close === 'complete' ? 200 : 204);

      const refused = await contribute();
      assert.deepEqual([refused.status, refused.body?.error?.code], [409, 'GOAL_NOT_ACTIVE'], close);
      const kept = (await api.call('GET', `/goals/${goalId}`, { token: user.token })).body!.data;
      assert.deepEqual([kept.currentAmount, kept.contributionCount], ['100.0000', 1], `${close}: earlier contributions stay`);
      const event = close === 'complete' ? 'GOAL_UPDATED' : 'GOAL_CANCELLED';
      assert.equal((await api.sql('SELECT id FROM audit_logs WHERE entity_id = $1 AND event = $2', [goalId, event])).length, 1, close);
    }
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

  describe('budget kinds (API spec §12.2)', () => {
    const OCTOBER = { startDate: '2026-10-01', endDate: '2026-10-31' };
    const IN_OCTOBER = '2026-10-15T09:00:00.000Z';

    async function newGoal(owner: ProbeUser = user): Promise<string> {
      const goal = await api.call('POST', '/goals', {
        token: owner.token,
        body: { walletId: owner.walletId, name: `probe-${randomUUID()}`, targetAmount: '1000000', currency: 'VND' },
      });
      assert.equal(goal.status, 201);
      return goal.body!.data.id as string;
    }

    it('BUD-US-02: counts every expense paid from the wallet toward a wallet-wide budget, but no transfer', async () => {
      const owner = await registerProbeUser(api, 'planning-wallet-wide');
      const bank = await createAccount(api, owner, owner.walletId, { initialBalance: '100000' });
      const cash = await createAccount(api, owner, owner.walletId);
      const groceries = await categoryOf(api, owner, owner.walletId, 'EXPENSE');
      const post = (body: Record<string, unknown>) =>
        api.call('POST', '/transactions', { token: owner.token, body: { currency: 'VND', transactionDate: IN_OCTOBER, ...body } });
      await post({ type: 'EXPENSE', fromAccountId: bank, categoryId: groceries, amount: '300' });
      await post({ type: 'EXPENSE', fromAccountId: cash, categoryId: groceries, amount: '200' });
      await post({ type: 'TRANSFER', fromAccountId: bank, toAccountId: cash, amount: '5000' });

      const created = await api.call('POST', '/budgets', {
        token: owner.token,
        body: { walletId: owner.walletId, categoryId: null, name: `probe-${randomUUID()}`, amount: '1000', currency: 'VND', periodType: 'CUSTOM', ...OCTOBER },
      });
      assert.equal(created.status, 201);
      assert.equal(created.body!.data.spent, '500.0000');
      const dashboard = await api.call('GET', `/dashboard?walletId=${owner.walletId}&dateFrom=${OCTOBER.startDate}&dateTo=${OCTOBER.endDate}`, { token: owner.token });
      assert.equal(dashboard.body!.data.activeBudgets[0].spent, '500.0000', 'the dashboard slice reads the same figure');
    });

    it("BUD-US-02: counts a goal-tagged expense and a contribution's backing expense toward the goal budget", async () => {
      const goalId = await newGoal();
      const created = await budget({ categoryId: null, goalId, periodType: 'GOAL', ...OCTOBER });
      assert.equal(created.status, 201);
      assert.equal(created.body!.data.spent, '0.0000');

      await expense({ amount: '40', goalId, transactionDate: IN_OCTOBER });
      await expense({ amount: '7', transactionDate: IN_OCTOBER });
      const contribution = await api.call('POST', `/goals/${goalId}/contributions`, {
        token: user.token,
        body: { accountId: vnd, amount: '60', currency: 'VND', contributionDate: IN_OCTOBER, recordAsTransaction: true, categoryId: food },
      });
      assert.equal(contribution.status, 201);
      const [backing] = await api.sql<{ goal_id: string }>('SELECT goal_id FROM transactions WHERE id = $1', [contribution.body!.data.transactionId]);
      assert.equal(backing?.goal_id, goalId, 'the backing expense carries its goal');

      const read = await api.call('GET', `/budgets/${created.body!.data.id}`, { token: user.token });
      assert.equal(read.body!.data.spent, '100.0000');
    });

    it('BUD-US-01: refuses a budget naming both a category and a goal, and a goal budget on a closed goal', async () => {
      const goalId = await newGoal();
      const both = await budget({ goalId, periodType: 'GOAL', ...OCTOBER });
      assert.deepEqual([both.status, both.body?.error?.code], [422, 'VALIDATION_FAILED']);

      await api.call('PATCH', `/goals/${goalId}`, { token: user.token, body: { status: 'COMPLETED' } });
      const closed = await budget({ categoryId: null, goalId, periodType: 'GOAL', ...OCTOBER });
      assert.deepEqual([closed.status, closed.body?.error?.code], [409, 'GOAL_NOT_ACTIVE']);
    });

    it("BUD-US-01, TXN-US-02: answers another wallet's goal as not found, on a budget and on an expense tag (AC-01)", async () => {
      const other = await registerProbeUser(api, 'planning-other-goal');
      const theirGoal = await newGoal(other);

      const onBudget = await budget({ categoryId: null, goalId: theirGoal, periodType: 'GOAL', ...OCTOBER });
      assert.deepEqual([onBudget.status, onBudget.body?.error?.code], [404, 'GOAL_NOT_FOUND']);
      const onExpense = await expense({ amount: '1', goalId: theirGoal, transactionDate: IN_OCTOBER });
      assert.deepEqual([onExpense.status, onExpense.body?.error?.code], [404, 'GOAL_NOT_FOUND']);
    });

    it('TXN-US-02/07: tags only an expense with a goal, on create and on edit', async () => {
      const goalId = await newGoal();
      const income = await api.call('POST', '/transactions', {
        token: user.token,
        body: { type: 'INCOME', toAccountId: vnd, categoryId: await categoryOf(api, user, user.walletId, 'INCOME'), amount: '1', currency: 'VND', transactionDate: IN_OCTOBER, goalId },
      });
      assert.deepEqual([income.status, income.body?.error?.code], [422, 'VALIDATION_FAILED']);
      assert.ok(income.body?.error?.fields?.goalId);

      const untagged = await expense({ amount: '3', transactionDate: IN_OCTOBER });
      const tagged = await api.call('PATCH', `/transactions/${untagged.body!.data.id}`, { token: user.token, body: { goalId } });
      assert.equal(tagged.body?.data.goalId, goalId);
      const cleared = await api.call('PATCH', `/transactions/${untagged.body!.data.id}`, { token: user.token, body: { goalId: null } });
      assert.equal(cleared.body?.data.goalId, null);
    });
  });
});
