import { strict as assert } from 'node:assert';
import { randomUUID } from 'node:crypto';
import { after, before, describe, it } from 'node:test';

import { AuditService } from '../src/audit/audit.service.ts';
import { addMember, categoryOf, createAccount, integrationSkipReason, registerProbeUser, startTestApi, type ProbeUser, type TestApi } from './support/integration.ts';

const IN_NOVEMBER = '2026-11-15T09:00:00.000Z';

/** §13 goals and contributions over HTTP, with progress read back from contributions (BR-05). */
describe('goals and contributions against a real database', { skip: integrationSkipReason() }, () => {
  let api: TestApi;

  before(async () => {
    api = await startTestApi();
  });

  after(async () => {
    await api?.close();
  });

  const createGoal = (user: ProbeUser, body: Record<string, unknown> = {}) =>
    api.call('POST', '/goals', {
      token: user.token,
      body: { walletId: user.walletId, name: `probe-${randomUUID()}`, targetAmount: '1000', currency: 'VND', ...body },
    });

  async function goalOf(user: ProbeUser, body: Record<string, unknown> = {}): Promise<string> {
    const goal = await createGoal(user, body);
    assert.equal(goal.status, 201);
    return goal.body!.data.id as string;
  }

  const contribute = (user: ProbeUser, goalId: string, body: Record<string, unknown>) =>
    api.call('POST', `/goals/${goalId}/contributions`, {
      token: user.token,
      body: { amount: '100', currency: 'VND', contributionDate: IN_NOVEMBER, ...body },
    });

  const balanceOf = async (user: ProbeUser, accountId: string) =>
    (await api.call('GET', `/accounts/${accountId}`, { token: user.token })).body!.data.balance as string;

  it('SAV-US-01: refuses a zero target with 422 and accepts a goal with no target date at 0 progress', async () => {
    const user = await registerProbeUser(api, 'goals-create');
    const zero = await createGoal(user, { targetAmount: '0' });
    assert.deepEqual([zero.status, zero.body?.error?.code], [422, 'VALIDATION_FAILED']);
    assert.ok(zero.body?.error?.fields?.targetAmount);

    const undated = await createGoal(user, { targetDate: null });
    assert.equal(undated.status, 201);
    assert.deepEqual(
      [undated.body!.data.targetDate, undated.body!.data.status, undated.body!.data.currentAmount, undated.body!.data.remaining, undated.body!.data.progressPercentage, undated.body!.data.contributionCount],
      [null, 'ACTIVE', '0.0000', '1000.0000', 0, 0],
    );
  });

  it('SAV-US-01: audits a create as GOAL_CREATED and refuses a VIEWER with 403', async () => {
    const user = await registerProbeUser(api, 'goals-audit');
    const goalId = await goalOf(user);
    const rows = await api.sql<{ event: string; result: string; actor_id: string; wallet_id: string }>(
      'SELECT event, result, actor_id, wallet_id FROM audit_logs WHERE entity_id = $1',
      [goalId],
    );
    assert.deepEqual(rows, [{ event: 'GOAL_CREATED', result: 'SUCCESS', actor_id: user.id, wallet_id: user.walletId }]);

    const viewer = await registerProbeUser(api, 'goals-audit-viewer');
    await addMember(api, user, user.walletId, viewer, 'VIEWER');
    const refused = await createGoal(viewer, { walletId: user.walletId });
    assert.deepEqual([refused.status, refused.body?.error?.code], [403, 'FORBIDDEN']);
  });

  it('SAV-US-02: a contribution without recordAsTransaction is an earmark — the goal advances, the account does not move', async () => {
    const user = await registerProbeUser(api, 'goals-earmark');
    const account = await createAccount(api, user, user.walletId, { initialBalance: '5000' });
    const goalId = await goalOf(user);

    const earmark = await contribute(user, goalId, { accountId: account, amount: '300' });
    assert.equal(earmark.status, 201);
    assert.equal(earmark.body!.data.transactionId, null);
    const transactions = await api.sql('SELECT id FROM transactions WHERE from_account_id = $1 OR to_account_id = $1', [account]);
    assert.equal(transactions.length, 0, 'an earmark writes no transaction');
    assert.equal(await balanceOf(user, account), '5000.0000');
    const goal = (await api.call('GET', `/goals/${goalId}`, { token: user.token })).body!.data;
    assert.deepEqual([goal.currentAmount, goal.progressPercentage, goal.contributionCount], ['300.0000', 30, 1]);
  });

  it('SAV-US-02: leaves neither the expense nor the contribution behind when a transaction-backed contribution fails partway', async () => {
    const user = await registerProbeUser(api, 'goals-atomic');
    const account = await createAccount(api, user, user.walletId, { initialBalance: '5000' });
    const category = await categoryOf(api, user, user.walletId, 'EXPENSE');
    const goalId = await goalOf(user);
    const audit = api.app.get(AuditService);
    const original = audit.record;
    // Throwing from the last step inside the transaction, after both inserts, forces the rollback path.
    audit.record = async () => {
      throw new Error('probe: audit refused');
    };
    try {
      const failed = await contribute(user, goalId, { accountId: account, amount: '250', recordAsTransaction: true, categoryId: category });
      assert.equal(failed.status, 500);
    } finally {
      audit.record = original;
    }

    assert.equal((await api.sql('SELECT id FROM transactions WHERE from_account_id = $1', [account])).length, 0, 'no backing expense');
    assert.equal((await api.sql('SELECT id FROM goal_contributions WHERE goal_id = $1', [goalId])).length, 0, 'no contribution');
    assert.equal(await balanceOf(user, account), '5000.0000');
    const goal = (await api.call('GET', `/goals/${goalId}`, { token: user.token })).body!.data;
    assert.deepEqual([goal.currentAmount, goal.contributionCount], ['0.0000', 0]);
  });

  it('SAV-US-02: refuses a currency that differs from the goal or the account, and an account outside the goal\'s wallet', async () => {
    const user = await registerProbeUser(api, 'goals-mismatch');
    const vnd = await createAccount(api, user, user.walletId, { initialBalance: '5000' });
    const usd = await createAccount(api, user, user.walletId, { currency: 'USD', initialBalance: '50' });
    const goalId = await goalOf(user);

    const usdIntoVndGoal = await contribute(user, goalId, { accountId: usd, currency: 'USD', amount: '10' });
    assert.deepEqual([usdIntoVndGoal.status, usdIntoVndGoal.body?.error?.code], [422, 'ACCOUNT_CURRENCY_MISMATCH'], 'currency differs from the goal');
    const vndFromUsdAccount = await contribute(user, goalId, { accountId: usd, currency: 'VND', amount: '10' });
    assert.deepEqual([vndFromUsdAccount.status, vndFromUsdAccount.body?.error?.code], [422, 'ACCOUNT_CURRENCY_MISMATCH'], 'currency differs from the account');
    const wrongCurrencyForBoth = await contribute(user, goalId, { accountId: vnd, currency: 'USD', amount: '10' });
    assert.deepEqual([wrongCurrencyForBoth.status, wrongCurrencyForBoth.body?.error?.code], [422, 'ACCOUNT_CURRENCY_MISMATCH']);

    const second = await api.call('POST', '/wallets', { token: user.token, body: { name: `probe-${randomUUID()}` } });
    assert.equal(second.status, 201);
    const ownOtherWallet = await createAccount(api, user, second.body!.data.id, { initialBalance: '5000' });
    const fromOwnOther = await contribute(user, goalId, { accountId: ownOtherWallet });
    assert.deepEqual([fromOwnOther.status, fromOwnOther.body?.error?.code], [403, 'FORBIDDEN'], 'an account of another wallet (§13.7)');

    const stranger = await registerProbeUser(api, 'goals-mismatch-stranger');
    const theirs = await createAccount(api, stranger, stranger.walletId, { initialBalance: '5000' });
    const fromStranger = await contribute(user, goalId, { accountId: theirs });
    assert.deepEqual([fromStranger.status, fromStranger.body?.error?.code], [404, 'ACCOUNT_NOT_FOUND'], 'an unseen account must not be confirmed to exist (AC-01)');

    assert.equal((await api.sql('SELECT id FROM goal_contributions WHERE goal_id = $1', [goalId])).length, 0);
  });

  it('SAV-US-03: pages a goal\'s contributions, marking each earmark or moved, and filters goals by status', async () => {
    const user = await registerProbeUser(api, 'goals-list');
    const account = await createAccount(api, user, user.walletId, { initialBalance: '5000' });
    const category = await categoryOf(api, user, user.walletId, 'EXPENSE');
    const goalId = await goalOf(user);
    const earmark = await contribute(user, goalId, { accountId: account, contributionDate: '2026-11-01T09:00:00.000Z' });
    const moved = await contribute(user, goalId, { accountId: account, contributionDate: '2026-11-02T09:00:00.000Z', recordAsTransaction: true, categoryId: category });
    const latest = await contribute(user, goalId, { accountId: account, contributionDate: '2026-11-03T09:00:00.000Z' });

    const page = (n: number) => api.call('GET', `/goals/${goalId}/contributions?page=${n}&pageSize=2`, { token: user.token });
    const first = await page(1);
    assert.equal(first.status, 200);
    assert.deepEqual(first.body!.meta.pagination, { page: 1, pageSize: 2, total: 3, hasMore: true });
    assert.deepEqual(
      (first.body!.data as { id: string; transactionId: string | null }[]).map((row) => [row.id, row.transactionId]),
      [
        [latest.body!.data.id, null],
        [moved.body!.data.id, moved.body!.data.transactionId],
      ],
    );
    assert.ok(moved.body!.data.transactionId, 'a moved contribution names its backing transaction');
    const second = await page(2);
    assert.deepEqual(second.body!.meta.pagination, { page: 2, pageSize: 2, total: 3, hasMore: false });
    assert.deepEqual((second.body!.data as { id: string; transactionId: string | null }[]).map((row) => [row.id, row.transactionId]), [[earmark.body!.data.id, null]]);

    const completed = await goalOf(user);
    assert.equal((await api.call('PATCH', `/goals/${completed}`, { token: user.token, body: { status: 'COMPLETED' } })).status, 200);
    const cancelled = await goalOf(user);
    assert.equal((await api.call('DELETE', `/goals/${cancelled}`, { token: user.token })).status, 204);
    const ids = async (status?: string) => {
      const response = await api.call('GET', `/goals?walletId=${user.walletId}${status ? `&status=${status}` : ''}`, { token: user.token });
      assert.equal(response.status, 200);
      return (response.body!.data as { id: string }[]).map((goal) => goal.id).sort();
    };
    assert.deepEqual(await ids(), [goalId, completed, cancelled].sort());
    assert.deepEqual(await ids('ACTIVE'), [goalId]);
    assert.deepEqual(await ids('COMPLETED'), [completed]);
    assert.deepEqual(await ids('CANCELLED'), [cancelled]);

    // API-05: newest first, paged with a total.
    const goalPage = (n: number) => api.call('GET', `/goals?walletId=${user.walletId}&page=${n}&pageSize=2`, { token: user.token });
    const firstGoals = await goalPage(1);
    assert.deepEqual(firstGoals.body!.meta.pagination, { page: 1, pageSize: 2, total: 3, hasMore: true });
    assert.equal((firstGoals.body!.data as { id: string }[])[0]!.id, cancelled);
    const secondGoals = await goalPage(2);
    assert.deepEqual(secondGoals.body!.meta.pagination, { page: 2, pageSize: 2, total: 3, hasMore: false });
    const paged = [...firstGoals.body!.data, ...secondGoals.body!.data] as { id: string }[];
    assert.deepEqual(paged.map((goal) => goal.id).sort(), [goalId, completed, cancelled].sort(), 'no row repeated or skipped');
  });

  it('SAV-US-04: changing the target moves remaining and progress on the next read, not the contributions; currency stays', async () => {
    const user = await registerProbeUser(api, 'goals-adjust');
    const account = await createAccount(api, user, user.walletId, { initialBalance: '5000' });
    const goalId = await goalOf(user, { targetAmount: '1000' });
    assert.equal((await contribute(user, goalId, { accountId: account, amount: '400' })).status, 201);

    const raised = await api.call('PATCH', `/goals/${goalId}`, { token: user.token, body: { targetAmount: '2000' } });
    assert.equal(raised.status, 200);
    const read = (await api.call('GET', `/goals/${goalId}`, { token: user.token })).body!.data;
    assert.deepEqual(
      [read.targetAmount, read.currentAmount, read.remaining, read.progressPercentage, read.contributionCount],
      ['2000.0000', '400.0000', '1600.0000', 20, 1],
    );

    await api.call('PATCH', `/goals/${goalId}`, { token: user.token, body: { name: `probe-${randomUUID()}`, currency: 'USD' } });
    const afterCurrency = (await api.call('GET', `/goals/${goalId}`, { token: user.token })).body!.data;
    assert.equal(afterCurrency.currency, 'VND', 'currency is immutable — contributions are already recorded in it (§13.4)');
    const [stored] = await api.sql<{ currency: string }>('SELECT currency FROM goals WHERE id = $1', [goalId]);
    assert.equal(stored?.currency, 'VND');
  });

  it('SAV-US-05: answers an unknown contribution with 404 and audits a removal as GOAL_CONTRIBUTION_REMOVED', async () => {
    const user = await registerProbeUser(api, 'goals-remove');
    const account = await createAccount(api, user, user.walletId, { initialBalance: '5000' });
    const goalId = await goalOf(user);

    const unknown = await api.call('DELETE', `/goals/${goalId}/contributions/${randomUUID()}`, { token: user.token });
    assert.deepEqual([unknown.status, unknown.body?.error?.code], [404, 'CONTRIBUTION_NOT_FOUND']);

    const otherGoal = await goalOf(user);
    const elsewhere = await contribute(user, otherGoal, { accountId: account });
    const crossGoal = await api.call('DELETE', `/goals/${goalId}/contributions/${elsewhere.body!.data.id}`, { token: user.token });
    assert.deepEqual([crossGoal.status, crossGoal.body?.error?.code], [404, 'CONTRIBUTION_NOT_FOUND'], 'a contribution is addressed through its own goal');

    const contribution = await contribute(user, goalId, { accountId: account });
    const contributionId = contribution.body!.data.id as string;
    assert.equal((await api.call('DELETE', `/goals/${goalId}/contributions/${contributionId}`, { token: user.token })).status, 204);
    const rows = await api.sql<{ event: string; result: string; actor_id: string; wallet_id: string }>(
      'SELECT event, result, actor_id, wallet_id FROM audit_logs WHERE entity_id = $1 ORDER BY id',
      [contributionId],
    );
    assert.deepEqual(
      rows.map((row) => row.event),
      ['GOAL_CONTRIBUTION_ADDED', 'GOAL_CONTRIBUTION_REMOVED'],
    );
    assert.deepEqual(rows.at(-1), { event: 'GOAL_CONTRIBUTION_REMOVED', result: 'SUCCESS', actor_id: user.id, wallet_id: user.walletId });
  });

  it('§6.5: in an archived wallet an earmark can still be removed, a transaction-backed contribution cannot', async () => {
    const user = await registerProbeUser(api, 'goals-archived-wallet');
    const account = await createAccount(api, user, user.walletId, { initialBalance: '1000' });
    const food = await categoryOf(api, user, user.walletId, 'EXPENSE');
    const goalId = await goalOf(user);
    const backed = await contribute(user, goalId, { accountId: account, recordAsTransaction: true, categoryId: food });
    const earmark = await contribute(user, goalId, { accountId: account });
    assert.deepEqual([backed.status, earmark.status], [201, 201]);
    assert.equal((await api.call('DELETE', `/wallets/${user.walletId}`, { token: user.token })).status, 204);

    const refused = await api.call('DELETE', `/goals/${goalId}/contributions/${backed.body!.data.id}`, { token: user.token });
    assert.deepEqual([refused.status, refused.body?.error?.code], [409, 'WALLET_ARCHIVED']);
    assert.deepEqual(await api.sql('SELECT status FROM transactions WHERE id = $1', [backed.body!.data.transactionId]), [{ status: 'COMPLETED' }]);

    const removed = await api.call('DELETE', `/goals/${goalId}/contributions/${earmark.body!.data.id}`, { token: user.token });
    assert.equal(removed.status, 204);
  });
});
