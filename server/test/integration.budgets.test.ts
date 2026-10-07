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
      body: { walletId: user.walletId, name: `probe-${randomUUID()}`, amount: '1000', currency: 'VND', periodType: 'CUSTOM', ...NOVEMBER, ...body },
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

    const second = await api.call('POST', '/wallets', { token: user.token, body: { name: `probe-${randomUUID()}`, timeZone: 'Asia/Ho_Chi_Minh' } });
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

  it('BUD-US-01/03/04: audits create, adjust and delete against the budget', async () => {
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
      ['BUDGET_CREATED', 'BUDGET_UPDATED', 'BUDGET_DELETED'].map((event) => ({ event, result: 'SUCCESS', actor_id: user.id, wallet_id: user.walletId })),
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

  it('BUD-US-02: lists a wallet\'s budgets by the day they cover, a repeating one on every day from its start, and hides a budget from a non-member', async () => {
    const { user, category } = await owner('list');
    const november = (await createBudget(user, { categoryId: category })).body!.data.id as string;
    const december = (await createBudget(user, { categoryId: category, startDate: '2026-12-01', endDate: '2026-12-31' })).body!.data.id as string;
    const repeating = (await createBudget(user, { categoryId: null, periodType: 'WEEKLY', startDate: '2026-11-10', endDate: null })).body!.data.id as string;

    const ids = async (query: string) => {
      const response = await api.call('GET', `/budgets?walletId=${user.walletId}${query}`, { token: user.token });
      assert.equal(response.status, 200, query);
      return (response.body!.data as { id: string }[]).map((budget) => budget.id).sort();
    };
    assert.deepEqual(await ids(''), [november, december, repeating].sort());
    assert.deepEqual(await ids('&activeOn=2026-11-05'), [november]);
    assert.deepEqual(await ids('&activeOn=2026-11-15'), [november, repeating].sort());
    assert.deepEqual(await ids('&activeOn=2026-12-01'), [december, repeating].sort());
    assert.deepEqual(await ids('&activeOn=2031-06-01'), [repeating]);

    // API-05: newest window first, paged with a total.
    const page = (n: number) => api.call('GET', `/budgets?walletId=${user.walletId}&page=${n}&pageSize=2`, { token: user.token });
    const first = await page(1);
    assert.deepEqual(first.body!.meta.pagination, { page: 1, pageSize: 2, total: 3, hasMore: true });
    assert.equal((first.body!.data as { id: string }[])[0]!.id, december);
    const second = await page(2);
    assert.deepEqual(second.body!.meta.pagination, { page: 2, pageSize: 2, total: 3, hasMore: false });
    const paged = [...first.body!.data, ...second.body!.data] as { id: string }[];
    assert.deepEqual(paged.map((budget) => budget.id).sort(), [november, december, repeating].sort(), 'no row repeated or skipped');

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
      [category, 'CUSTOM', NOVEMBER.startDate, NOVEMBER.endDate, '400.0000'],
      'category, period and dates are immutable (§12.4)',
    );
  });

  it('BUD-US-04: a delete answers 204, removes the row, leaves the transactions, and frees its overlap slot', async () => {
    const { user, account, category } = await owner('delete');
    const spent = await post(user, { type: 'EXPENSE', fromAccountId: account, categoryId: category, amount: '250' });
    const created = await createBudget(user, { categoryId: category });
    const budgetId = created.body!.data.id as string;

    const deleted = await api.call('DELETE', `/budgets/${budgetId}`, { token: user.token });
    assert.equal(deleted.status, 204);
    assert.equal(deleted.body, null, '204 carries no body');

    assert.deepEqual(await api.sql('SELECT id FROM budgets WHERE id = $1', [budgetId]), [], 'the row is gone');
    const read = await api.call('GET', `/budgets/${budgetId}`, { token: user.token });
    assert.deepEqual([read.status, read.body?.error?.code], [404, 'BUDGET_NOT_FOUND']);
    const again = await api.call('DELETE', `/budgets/${budgetId}`, { token: user.token });
    assert.deepEqual([again.status, again.body?.error?.code], [404, 'BUDGET_NOT_FOUND']);
    const [kept] = await api.sql<{ status: string }>('SELECT status FROM transactions WHERE id = $1', [spent.body!.data.id]);
    assert.equal(kept?.status, 'COMPLETED', 'deleting a plan touches no transaction');

    const replacement = await createBudget(user, { categoryId: category });
    assert.equal(replacement.status, 201, 'a deleted budget no longer occupies the window');
  });

  it('BUD-US-01/02: a monthly budget repeats every month with no end date, each read counting its own month', async () => {
    const { user, account, category } = await owner('repeating');
    await post(user, { type: 'EXPENSE', fromAccountId: account, categoryId: category, amount: '100', transactionDate: '2026-11-15T09:00:00.000Z' });
    await post(user, { type: 'EXPENSE', fromAccountId: account, categoryId: category, amount: '30', transactionDate: '2027-03-10T09:00:00.000Z' });
    const created = await createBudget(user, { categoryId: category, periodType: 'MONTHLY', startDate: '2026-11-01', endDate: null });
    assert.equal(created.status, 201);
    assert.equal(created.body!.data.endDate, null);

    const on = async (day: string) => {
      const listed = await api.call('GET', `/budgets?walletId=${user.walletId}&activeOn=${day}`, { token: user.token });
      const [budget] = listed.body!.data as { periodStart: string; periodEnd: string; spent: string }[];
      return [budget?.periodStart, budget?.periodEnd, budget?.spent];
    };
    assert.deepEqual(await on('2026-11-20'), ['2026-11-01', '2026-11-30', '100.0000']);
    assert.deepEqual(await on('2027-03-01'), ['2027-03-01', '2027-03-31', '30.0000']);
    assert.deepEqual(await on('2027-02-14'), ['2027-02-01', '2027-02-28', '0.0000']);

    const later = await createBudget(user, { categoryId: category, startDate: '2027-06-01', endDate: '2027-06-30' });
    assert.deepEqual([later.status, later.body?.error?.code], [409, 'BUDGET_PERIOD_OVERLAP'], 'a repeating budget holds its category from its start onward');
  });

  it('BUD-US-01: a repeating period refuses an end date and a fixed one requires it', async () => {
    const { user, category } = await owner('end-date');
    const withEnd = await createBudget(user, { categoryId: category, periodType: 'MONTHLY' });
    assert.deepEqual([withEnd.status, withEnd.body?.error?.code], [422, 'VALIDATION_FAILED']);
    const withoutEnd = await createBudget(user, { categoryId: category, endDate: null });
    assert.deepEqual([withoutEnd.status, withoutEnd.body?.error?.code], [422, 'VALIDATION_FAILED']);
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

  it('BUD-US-02: a category budget counts its subcategories, at any depth, and reports which categories it covers', async () => {
    const { user, account } = await owner('subtree');
    const newCategory = async (name: string, parentId?: string) => {
      const created = await api.call('POST', '/categories', {
        token: user.token,
        body: { walletId: user.walletId, name: `${name}-${randomUUID().slice(0, 8)}`, type: 'EXPENSE', parentId },
      });
      assert.equal(created.status, 201, JSON.stringify(created.body));
      return created.body!.data.id as string;
    };
    const parent = await newCategory('probe-transport');
    const child = await newCategory('probe-grab', parent);
    const grandchild = await newCategory('probe-grabbike', child);
    const unrelated = await newCategory('probe-other');
    for (const categoryId of [parent, child, grandchild, unrelated]) {
      assert.equal((await post(user, { type: 'EXPENSE', fromAccountId: account, categoryId, amount: '100' })).status, 201);
    }

    const onParent = await createBudget(user, { categoryId: parent });
    assert.equal(onParent.status, 201);
    assert.equal(onParent.body!.data.spent, '300.0000');
    assert.deepEqual([...onParent.body!.data.categoryIds].sort(), [parent, child, grandchild].sort());

    const onChild = await createBudget(user, { categoryId: child });
    assert.equal(onChild.body!.data.spent, '200.0000', 'a child budget counts its own subtree, not its parent');
  });
});
