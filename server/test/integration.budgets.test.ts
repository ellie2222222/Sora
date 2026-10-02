import { strict as assert } from 'node:assert';
import { randomUUID } from 'node:crypto';
import { after, before, describe, it } from 'node:test';

import { addMember, categoryOf, createAccount, integrationSkipReason, registerProbeUser, startTestApi, type ProbeUser, type TestApi } from './support/integration.ts';

const NOVEMBER = { startDate: '2026-11-01', endDate: '2026-11-30' };
const IN_NOVEMBER = '2026-11-15T09:00:00.000Z';

/** §12 budgets over HTTP: kinds, lifecycle, list filters and what `spent` may count (BR-04/05/06). */
describe('budgets against a real database', { skip: integrationSkipReason() }, () => {
  let api: TestApi;

  before(async () => {
    api = await startTestApi();
  });

  after(async () => {
    await api?.close();
  });

  async function owner(tag: string) {
    const user = await registerProbeUser(api, `budgets-${tag}`);
    const account = await createAccount(api, user, user.walletId, { initialBalance: '100000' });
    const category = await categoryOf(api, user, user.walletId, 'EXPENSE');
    return { user, account, category };
  }

  const createBudget = (user: ProbeUser, body: Record<string, unknown>) =>
    api.call('POST', '/budgets', {
      token: user.token,
      body: { walletId: user.walletId, name: `probe-${randomUUID()}`, amount: '1000', currency: 'VND', periodType: 'MONTHLY', ...NOVEMBER, ...body },
    });

  const post = (user: ProbeUser, body: Record<string, unknown>) =>
    api.call('POST', '/transactions', { token: user.token, body: { currency: 'VND', transactionDate: IN_NOVEMBER, ...body } });

  async function newGoal(user: ProbeUser): Promise<string> {
    const goal = await api.call('POST', '/goals', {
      token: user.token,
      body: { walletId: user.walletId, name: `probe-${randomUUID()}`, targetAmount: '1000000', currency: 'VND' },
    });
    assert.equal(goal.status, 201);
    return goal.body!.data.id as string;
  }

  it('BUD-US-01: refuses an INCOME category with 422 and another wallet\'s category as not found (AC-01)', async () => {
    const { user } = await owner('category-rules');
    const income = await categoryOf(api, user, user.walletId, 'INCOME');
    const onIncome = await createBudget(user, { categoryId: income });
    assert.deepEqual([onIncome.status, onIncome.body?.error?.code], [422, 'CATEGORY_WRONG_TYPE']);

    const stranger = await registerProbeUser(api, 'budgets-category-stranger');
    const theirs = await categoryOf(api, stranger, stranger.walletId, 'EXPENSE');
    const onStrangers = await createBudget(user, { categoryId: theirs });
    assert.deepEqual([onStrangers.status, onStrangers.body?.error?.code], [404, 'CATEGORY_NOT_FOUND'], 'a category in an unseen wallet must not be confirmed to exist');

    const second = await api.call('POST', '/wallets', { token: user.token, body: { name: `probe-${randomUUID()}` } });
    assert.equal(second.status, 201);
    const ownOtherCategory = await api.call('POST', '/categories', {
      token: user.token,
      body: { walletId: second.body!.data.id, name: `probe-${randomUUID()}`, type: 'EXPENSE' },
    });
    assert.equal(ownOtherCategory.status, 201);
    const ownOther = ownOtherCategory.body!.data.id as string;
    const onOwnOther = await createBudget(user, { categoryId: ownOther });
    assert.deepEqual([onOwnOther.status, onOwnOther.body?.error?.code], [403, 'CATEGORY_WRONG_WALLET']);
  });

  it('BUD-US-01/03/04: audits create, adjust and archive against the budget', async () => {
    const { user, category } = await owner('audit');
    const created = await createBudget(user, { categoryId: category });
    assert.equal(created.status, 201);
    const budgetId = created.body!.data.id as string;
    assert.equal((await api.call('PATCH', `/budgets/${budgetId}`, { token: user.token, body: { amount: '2000' } })).status, 200);
    assert.equal((await api.call('DELETE', `/budgets/${budgetId}`, { token: user.token })).status, 204);

    const rows = await api.sql<{ event: string; result: string; actor_id: string; wallet_id: string }>(
      'SELECT event, result, actor_id, wallet_id FROM audit_logs WHERE entity_id = $1 ORDER BY id',
      [budgetId],
    );
    assert.deepEqual(
      rows,
      ['BUDGET_CREATED', 'BUDGET_UPDATED', 'BUDGET_ARCHIVED'].map((event) => ({ event, result: 'SUCCESS', actor_id: user.id, wallet_id: user.walletId })),
    );
  });

  it('BUD-US-02: leaves transfers, income, other categories, deleted and pending rows and other months out of a category budget', async () => {
    const { user, account, category } = await owner('spent-exclusions');
    const cash = await createAccount(api, user, user.walletId);
    const income = await categoryOf(api, user, user.walletId, 'INCOME');
    const otherCategory = (await api.call('GET', `/categories?walletId=${user.walletId}&type=EXPENSE&pageSize=200`, { token: user.token })).body!.data.find(
      (candidate: { id: string }) => candidate.id !== category,
    ).id as string;

    assert.equal((await post(user, { type: 'EXPENSE', fromAccountId: account, categoryId: category, amount: '100' })).status, 201);
    assert.equal((await post(user, { type: 'TRANSFER', fromAccountId: account, toAccountId: cash, amount: '5000' })).status, 201);
    // The API refuses an EXPENSE category on a transfer, but another writer can store one; spent must still skip it (BR-06).
    await api.sql(
      `INSERT INTO transactions (created_by_user_id, from_account_id, to_account_id, category_id, type, amount, currency, transaction_date, status)
       VALUES ($1, $2, $3, $4, 'TRANSFER', '3000', 'VND', $5, 'COMPLETED')`,
      [user.id, account, cash, category, IN_NOVEMBER],
    );
    assert.equal((await post(user, { type: 'INCOME', toAccountId: account, categoryId: income, amount: '700' })).status, 201);
    assert.equal((await post(user, { type: 'EXPENSE', fromAccountId: account, categoryId: otherCategory, amount: '11' })).status, 201);
    assert.equal((await post(user, { type: 'EXPENSE', fromAccountId: account, categoryId: category, amount: '13', status: 'PENDING' })).status, 201);
    assert.equal((await post(user, { type: 'EXPENSE', fromAccountId: account, categoryId: category, amount: '17', transactionDate: '2026-10-31T09:00:00.000Z' })).status, 201);
    const deleted = await post(user, { type: 'EXPENSE', fromAccountId: account, categoryId: category, amount: '19' });
    assert.equal((await api.call('POST', `/transactions/${deleted.body!.data.id}/delete`, { token: user.token, body: {} })).status, 200);

    const created = await createBudget(user, { categoryId: category });
    assert.equal(created.status, 201);
    assert.equal(created.body!.data.spent, '100.0000', 'only the one completed in-window expense of this category counts');
    assert.equal((await api.call('GET', `/budgets/${created.body!.data.id}`, { token: user.token })).body!.data.spent, '100.0000');
  });

  it('BUD-US-02: lists a wallet\'s budgets filtered by status and by the day they cover, and hides a budget from a non-member', async () => {
    const { user, category } = await owner('list');
    const november = (await createBudget(user, { categoryId: category })).body!.data.id as string;
    const december = (await createBudget(user, { categoryId: category, startDate: '2026-12-01', endDate: '2026-12-31' })).body!.data.id as string;
    const archived = (await createBudget(user, { categoryId: null, startDate: '2026-11-10', endDate: '2026-11-20' })).body!.data.id as string;
    assert.equal((await api.call('DELETE', `/budgets/${archived}`, { token: user.token })).status, 204);

    const ids = async (query: string) => {
      const response = await api.call('GET', `/budgets?walletId=${user.walletId}${query}`, { token: user.token });
      assert.equal(response.status, 200, query);
      return (response.body!.data as { id: string }[]).map((budget) => budget.id).sort();
    };
    assert.deepEqual(await ids(''), [november, december, archived].sort());
    assert.deepEqual(await ids('&status=ACTIVE'), [november, december].sort());
    assert.deepEqual(await ids('&status=ARCHIVED'), [archived]);
    assert.deepEqual(await ids('&activeOn=2026-11-15'), [november, archived].sort());
    assert.deepEqual(await ids('&activeOn=2026-12-01'), [december]);
    assert.deepEqual(await ids('&status=ACTIVE&activeOn=2026-11-15'), [november]);

    const stranger = await registerProbeUser(api, 'budgets-list-stranger');
    const detail = await api.call('GET', `/budgets/${november}`, { token: stranger.token });
    assert.deepEqual([detail.status, detail.body?.error?.code], [404, 'BUDGET_NOT_FOUND']);
    const list = await api.call('GET', `/budgets?walletId=${user.walletId}`, { token: stranger.token });
    assert.deepEqual([list.status, list.body?.error?.code], [404, 'WALLET_NOT_FOUND']);
  });

  it('BUD-US-03: adjusting the amount moves remaining and usage but not spent; a VIEWER is refused; the window and target stay fixed', async () => {
    const { user, account, category } = await owner('adjust');
    await post(user, { type: 'EXPENSE', fromAccountId: account, categoryId: category, amount: '400' });
    const created = await createBudget(user, { categoryId: category, amount: '1000' });
    const budgetId = created.body!.data.id as string;
    assert.deepEqual([created.body!.data.spent, created.body!.data.remaining, created.body!.data.usagePercentage], ['400.0000', '600.0000', 40]);

    const lowered = await api.call('PATCH', `/budgets/${budgetId}`, { token: user.token, body: { amount: '200' } });
    assert.equal(lowered.status, 200);
    assert.deepEqual(
      [lowered.body!.data.amount, lowered.body!.data.spent, lowered.body!.data.remaining, lowered.body!.data.usagePercentage, lowered.body!.data.isOverBudget],
      ['200.0000', '400.0000', '-200.0000', 200, true],
    );

    const viewer = await registerProbeUser(api, 'budgets-adjust-viewer');
    await addMember(api, user, user.walletId, viewer, 'VIEWER');
    const refused = await api.call('PATCH', `/budgets/${budgetId}`, { token: viewer.token, body: { amount: '9999' } });
    assert.deepEqual([refused.status, refused.body?.error?.code], [403, 'FORBIDDEN']);

    const otherCategory = (await api.call('GET', `/categories?walletId=${user.walletId}&type=EXPENSE&pageSize=200`, { token: user.token })).body!.data.find(
      (candidate: { id: string }) => candidate.id !== category,
    ).id as string;
    await api.call('PATCH', `/budgets/${budgetId}`, {
      token: user.token,
      body: { amount: '300', categoryId: otherCategory, periodType: 'YEARLY', startDate: '2026-01-01', endDate: '2026-12-31' },
    });
    const read = (await api.call('GET', `/budgets/${budgetId}`, { token: user.token })).body!.data;
    assert.deepEqual(
      [read.categoryId, read.periodType, read.startDate, read.endDate, read.spent],
      [category, 'MONTHLY', NOVEMBER.startDate, NOVEMBER.endDate, '400.0000'],
      'category, period and dates are immutable (§12.4)',
    );
  });

  it('BUD-US-04: an archived budget answers 204, stays readable as ARCHIVED, and frees its overlap slot', async () => {
    const { user, account, category } = await owner('archive');
    await post(user, { type: 'EXPENSE', fromAccountId: account, categoryId: category, amount: '250' });
    const created = await createBudget(user, { categoryId: category });
    const budgetId = created.body!.data.id as string;

    const archived = await api.call('DELETE', `/budgets/${budgetId}`, { token: user.token });
    assert.equal(archived.status, 204);
    assert.equal(archived.body, null, '204 carries no body');

    const read = await api.call('GET', `/budgets/${budgetId}`, { token: user.token });
    assert.equal(read.status, 200);
    assert.deepEqual([read.body!.data.status, read.body!.data.spent], ['ARCHIVED', '250.0000'], 'archived, not removed, and still derived');

    const replacement = await createBudget(user, { categoryId: category });
    assert.equal(replacement.status, 201, 'an archived budget no longer occupies the window');
  });

  it('BUD-US-01: refuses an overlapping goal budget with 409, while budgets of other kinds on the same days are allowed', async () => {
    const { user, category } = await owner('goal-overlap');
    const goalId = await newGoal(user);
    const first = await createBudget(user, { categoryId: null, goalId, periodType: 'GOAL' });
    assert.equal(first.status, 201);

    const overlapping = await createBudget(user, { categoryId: null, goalId, periodType: 'GOAL', startDate: '2026-11-30', endDate: '2026-12-31' });
    assert.deepEqual([overlapping.status, overlapping.body?.error?.code], [409, 'BUDGET_PERIOD_OVERLAP'], 'sharing only the last day still overlaps');

    const otherGoal = await createBudget(user, { categoryId: null, goalId: await newGoal(user), periodType: 'GOAL' });
    assert.equal(otherGoal.status, 201, 'a different goal is a different target');
    assert.equal((await createBudget(user, { categoryId: category })).status, 201, 'a category budget is not blocked by a goal budget');
    assert.equal((await createBudget(user, { categoryId: null })).status, 201, 'a wallet-wide budget is not blocked either');
  });
});
