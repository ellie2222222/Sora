import { strict as assert } from 'node:assert';
import { randomUUID } from 'node:crypto';
import { after, before, describe, it } from 'node:test';

import {
  addMember,
  categoryOf,
  createAccount,
  integrationSkipReason,
  registerProbeUser,
  startTestApi,
  type ProbeUser,
  type TestApi,
} from './support/integration.ts';

const PERIOD = { dateFrom: '2026-05-01', dateTo: '2026-05-31' };
const IN_PERIOD = '2026-05-10T09:00:00.000Z';

/** API spec §11 transactions over HTTP: attribution, transfer refusals, listing, correction and delete side effects. */
describe('transactions against a real database', { skip: integrationSkipReason() }, () => {
  let api: TestApi;

  const newWallet = async (user: ProbeUser): Promise<string> =>
    (await api.call('POST', '/wallets', { token: user.token, body: { name: `probe-${randomUUID()}` } })).body!.data.id;

  const transact = (user: ProbeUser, body: Record<string, unknown>) =>
    api.call('POST', '/transactions', { token: user.token, body: { currency: 'VND', transactionDate: IN_PERIOD, ...body } });

  before(async () => {
    api = await startTestApi();
  });

  after(async () => {
    await api?.close();
  });

  it('TXN-US-02: an EDITOR records an expense, and both createdBy and the audit row name the editor', async () => {
    const owner = await registerProbeUser(api, 'txn-owner');
    const editor = await registerProbeUser(api, 'txn-editor');
    await addMember(api, owner, owner.walletId, editor, 'EDITOR');
    const account = await createAccount(api, owner, owner.walletId, { initialBalance: '100' });
    const food = await categoryOf(api, owner, owner.walletId, 'EXPENSE');

    const created = await transact(editor, { type: 'EXPENSE', fromAccountId: account, categoryId: food, amount: '12' });
    assert.equal(created.status, 201);
    assert.equal(created.body!.data.createdBy.id, editor.id);
    const [stored] = await api.sql<{ created_by_user_id: string }>('SELECT created_by_user_id FROM transactions WHERE id = $1', [created.body!.data.id]);
    assert.equal(stored?.created_by_user_id, editor.id);

    const audit = await api.sql<{ actor_id: string; wallet_id: string }>(
      'SELECT actor_id, wallet_id FROM audit_logs WHERE entity_id = $1 AND event = $2',
      [created.body!.data.id, 'TRANSACTION_CREATED'],
    );
    assert.deepEqual(audit, [{ actor_id: editor.id, wallet_id: owner.walletId }]);
  });

  it('TXN-US-03: refuses a transfer between accounts of different currencies with TRANSFER_CURRENCY_MISMATCH', async () => {
    const user = await registerProbeUser(api, 'txn-fx');
    const vnd = await createAccount(api, user, user.walletId, { initialBalance: '100' });
    const usd = await createAccount(api, user, user.walletId, { currency: 'USD', initialBalance: '100' });

    const refused = await transact(user, { type: 'TRANSFER', fromAccountId: vnd, toAccountId: usd, amount: '1' });
    assert.deepEqual([refused.status, refused.body?.error?.code], [422, 'TRANSFER_CURRENCY_MISMATCH']);
  });

  it('TXN-US-03: refuses a transfer from an account to itself as a validation failure on toAccountId (API spec §11.2)', async () => {
    const user = await registerProbeUser(api, 'txn-self');
    const account = await createAccount(api, user, user.walletId, { initialBalance: '100' });

    const refused = await transact(user, { type: 'TRANSFER', fromAccountId: account, toAccountId: account, amount: '1' });
    assert.deepEqual([refused.status, refused.body?.error?.code], [422, 'VALIDATION_FAILED']);
    assert.ok(refused.body?.error?.fields?.toAccountId);
  });

  it('TXN-US-03: a refused same-account or cross-currency transfer leaves no row and moves nothing', async () => {
    const user = await registerProbeUser(api, 'txn-refused');
    const vnd = await createAccount(api, user, user.walletId, { initialBalance: '100' });
    const usd = await createAccount(api, user, user.walletId, { currency: 'USD', initialBalance: '100' });
    const description = `probe-refused-${randomUUID()}`;

    const self = await transact(user, { type: 'TRANSFER', fromAccountId: vnd, toAccountId: vnd, amount: '1', description });
    const fx = await transact(user, { type: 'TRANSFER', fromAccountId: vnd, toAccountId: usd, amount: '1', description });
    assert.deepEqual([self.status, fx.status], [422, 422]);
    assert.deepEqual(await api.sql('SELECT id FROM transactions WHERE description = $1', [description]), []);
    assert.equal((await api.call('GET', `/accounts/${vnd}`, { token: user.token })).body!.data.balance, '100.0000');
  });

  it('TXN-US-04: a cross-wallet transfer is transferredOut for the sender and transferredIn for the receiver, never income, expense or budget spend', async () => {
    const user = await registerProbeUser(api, 'txn-xw-dash');
    const receiver = await newWallet(user);
    const from = await createAccount(api, user, user.walletId, { initialBalance: '1000' });
    const to = await createAccount(api, user, receiver);
    const budgetIn = async (walletId: string) =>
      (
        await api.call('POST', '/budgets', {
          token: user.token,
          body: { walletId, categoryId: null, name: `probe-${randomUUID()}`, amount: '1000', currency: 'VND', periodType: 'CUSTOM', startDate: PERIOD.dateFrom, endDate: PERIOD.dateTo },
        })
      ).body!.data.id as string;
    const senderBudget = await budgetIn(user.walletId);
    const receiverBudget = await budgetIn(receiver);

    assert.equal((await transact(user, { type: 'TRANSFER', fromAccountId: from, toAccountId: to, amount: '300' })).status, 201);

    const dashboard = async (walletId: string) =>
      (await api.call('GET', `/dashboard?walletId=${walletId}&dateFrom=${PERIOD.dateFrom}&dateTo=${PERIOD.dateTo}`, { token: user.token })).body!.data;
    const sender = await dashboard(user.walletId);
    const recipient = await dashboard(receiver);
    assert.deepEqual([sender.transferredOut, sender.transferredIn], [[{ currency: 'VND', amount: '300.0000' }], []]);
    assert.deepEqual([recipient.transferredIn, recipient.transferredOut], [[{ currency: 'VND', amount: '300.0000' }], []]);
    for (const dash of [sender, recipient]) {
      assert.deepEqual([dash.income, dash.expense, dash.spendingByCategory], [[], [], []]);
    }
    for (const budgetId of [senderBudget, receiverBudget]) {
      const budget = await api.call('GET', `/budgets/${budgetId}`, { token: user.token });
      assert.equal(budget.body!.data.spent, '0.0000');
    }
  });

  describe('TXN-US-05: listing', () => {
    let user: ProbeUser;
    let bank = '';
    let cash = '';
    let food = '';
    let salary = '';
    const ids = {} as Record<'salary' | 'lunch' | 'move' | 'snack' | 'later' | 'gone', string>;
    const tag = `probe-list-${randomUUID()}`;

    const list = (query: string) => api.call('GET', `/transactions?${query}`, { token: user.token });
    const listedIds = (response: { body: { data: { id: string }[] } | null }) => response.body!.data.map((row) => row.id);

    before(async () => {
      user = await registerProbeUser(api, 'txn-list');
      bank = await createAccount(api, user, user.walletId, { initialBalance: '10000' });
      cash = await createAccount(api, user, user.walletId);
      food = await categoryOf(api, user, user.walletId, 'EXPENSE');
      salary = await categoryOf(api, user, user.walletId, 'INCOME');
      const post = async (key: keyof typeof ids, body: Record<string, unknown>) => {
        const created = await transact(user, body);
        assert.equal(created.status, 201, `${key}: ${JSON.stringify(created.body)}`);
        ids[key] = created.body!.data.id;
      };
      await post('salary', { type: 'INCOME', toAccountId: bank, categoryId: salary, amount: '5000', transactionDate: '2026-05-01T08:00:00.000Z' });
      await post('lunch', { type: 'EXPENSE', fromAccountId: bank, categoryId: food, amount: '40', transactionDate: '2026-05-05T12:00:00.000Z', description: `${tag} lunch` });
      await post('move', { type: 'TRANSFER', fromAccountId: bank, toAccountId: cash, amount: '200', transactionDate: '2026-05-12T10:00:00.000Z' });
      await post('snack', { type: 'EXPENSE', fromAccountId: cash, categoryId: food, amount: '15', transactionDate: '2026-05-20T15:00:00.000Z' });
      await post('later', { type: 'EXPENSE', fromAccountId: bank, categoryId: food, amount: '700', transactionDate: '2026-06-02T09:00:00.000Z', status: 'PENDING' });
      await post('gone', { type: 'EXPENSE', fromAccountId: bank, categoryId: food, amount: '900', transactionDate: '2026-05-25T09:00:00.000Z' });
      await api.call('POST', `/transactions/${ids.gone}/delete`, { token: user.token, body: {} });
    });

    it('TXN-US-05: sorts by -transactionDate by default and paginates with meta.pagination (API-05/06)', async () => {
      const all = await list(`walletId=${user.walletId}`);
      assert.equal(all.status, 200);
      assert.deepEqual(listedIds(all), [ids.later, ids.gone, ids.snack, ids.move, ids.lunch, ids.salary]);
      assert.deepEqual(all.body!.meta.pagination, { page: 1, pageSize: 25, total: 6, hasMore: false });

      const page2 = await list(`walletId=${user.walletId}&pageSize=2&page=2`);
      assert.deepEqual(listedIds(page2), [ids.snack, ids.move]);
      assert.deepEqual(page2.body!.meta.pagination, { page: 2, pageSize: 2, total: 6, hasMore: true });

      for (const bad of ['pageSize=201', 'pageSize=0', 'page=0']) {
        const refused = await list(`walletId=${user.walletId}&${bad}`);
        assert.deepEqual([refused.status, refused.body?.error?.code], [422, 'VALIDATION_FAILED'], bad);
      }
    });

    it('TXN-US-05: honours a custom sortBy, including a multi-key one', async () => {
      const byAmount = await list(`walletId=${user.walletId}&sortBy=amount`);
      assert.deepEqual(listedIds(byAmount), [ids.snack, ids.lunch, ids.move, ids.later, ids.gone, ids.salary]);
      const byAmountDesc = await list(`walletId=${user.walletId}&sortBy=-amount`);
      assert.deepEqual(listedIds(byAmountDesc), [ids.salary, ids.gone, ids.later, ids.move, ids.lunch, ids.snack]);
      const byTypeThenDate = await list(`walletId=${user.walletId}&type=EXPENSE&sortBy=transactionDate,amount`);
      assert.deepEqual(listedIds(byTypeThenDate), [ids.lunch, ids.snack, ids.gone, ids.later]);
    });

    it('TXN-US-05: filters by account, category, type, status, date range, amount range and text', async () => {
      const cases: [string, string[]][] = [
        [`accountId=${cash}`, [ids.snack, ids.move]],
        [`categoryId=${salary}`, [ids.salary]],
        ['type=TRANSFER', [ids.move]],
        ['status=PENDING', [ids.later]],
        ['status=DELETED', [ids.gone]],
        ['dateFrom=2026-05-05&dateTo=2026-05-20', [ids.snack, ids.move, ids.lunch]],
        ['minAmount=40&maxAmount=700', [ids.later, ids.move, ids.lunch]],
        [`search=${encodeURIComponent(tag.toUpperCase())}`, [ids.lunch]],
      ];
      for (const [query, expected] of cases) {
        const response = await list(`walletId=${user.walletId}&${query}`);
        assert.equal(response.status, 200, query);
        assert.deepEqual(listedIds(response), expected, query);
        assert.equal(response.body!.meta.pagination.total, expected.length, query);
      }
    });

    it('TXN-US-05: lists a deleted row marked DELETED and leaves it out of the totals beside the list', async () => {
      const listed = await list(`walletId=${user.walletId}&accountId=${bank}`);
      const gone = listed.body!.data.find((row: { id: string }) => row.id === ids.gone);
      assert.equal(gone?.status, 'DELETED');

      const detail = (await api.call('GET', `/accounts/${bank}`, { token: user.token })).body!.data;
      assert.equal(detail.totalExpense, '40.0000', 'neither the deleted nor the pending expense counts');
      assert.equal(detail.balance, '14760.0000');
      const dash = (await api.call('GET', `/dashboard?walletId=${user.walletId}&dateFrom=${PERIOD.dateFrom}&dateTo=${PERIOD.dateTo}`, { token: user.token })).body!.data;
      assert.deepEqual(dash.expense, [{ currency: 'VND', amount: '55.0000' }]);
    });
  });

  it('TXN-US-06: a VIEWER of only the receiving wallet reads a cross-wallet transfer with both wallet names', async () => {
    const owner = await registerProbeUser(api, 'txn-xw-owner');
    const receiving = await newWallet(owner);
    const from = await createAccount(api, owner, owner.walletId, { initialBalance: '100' });
    const to = await createAccount(api, owner, receiving);
    const transfer = await transact(owner, { type: 'TRANSFER', fromAccountId: from, toAccountId: to, amount: '10' });
    const viewer = await registerProbeUser(api, 'txn-xw-viewer');
    await addMember(api, owner, receiving, viewer, 'VIEWER');

    const read = await api.call('GET', `/transactions/${transfer.body!.data.id}`, { token: viewer.token });
    assert.equal(read.status, 200);
    const names = await api.sql<{ id: string; name: string }>('SELECT id, name FROM wallets WHERE id = ANY($1::uuid[])', [[owner.walletId, receiving]]);
    const nameOf = (id: string) => names.find((row) => row.id === id)!.name;
    assert.deepEqual(
      [read.body!.data.fromAccount.walletName, read.body!.data.toAccount.walletName],
      [nameOf(owner.walletId), nameOf(receiving)],
    );
    assert.equal(read.body!.data.isCrossWallet, true);
  });

  it('TXN-US-07: refuses a category of another type, and removing an expense category; allows removing a transfer category', async () => {
    const user = await registerProbeUser(api, 'txn-recat');
    const bank = await createAccount(api, user, user.walletId, { initialBalance: '100' });
    const cash = await createAccount(api, user, user.walletId);
    const food = await categoryOf(api, user, user.walletId, 'EXPENSE');
    const salary = await categoryOf(api, user, user.walletId, 'INCOME');
    const label = await api.call('POST', '/categories', { token: user.token, body: { walletId: user.walletId, name: `probe-${randomUUID()}`, type: 'TRANSFER' } });
    assert.equal(label.status, 201);

    const expense = (await transact(user, { type: 'EXPENSE', fromAccountId: bank, categoryId: food, amount: '5' })).body!.data.id as string;
    for (const categoryId of [salary, null]) {
      const refused = await api.call('PATCH', `/transactions/${expense}`, { token: user.token, body: { categoryId } });
      assert.deepEqual([refused.status, refused.body?.error?.code], [422, 'CATEGORY_WRONG_TYPE'], `categoryId ${categoryId}`);
    }
    const [unchanged] = await api.sql<{ category_id: string }>('SELECT category_id FROM transactions WHERE id = $1', [expense]);
    assert.equal(unchanged?.category_id, food);

    const transfer = await transact(user, { type: 'TRANSFER', fromAccountId: bank, toAccountId: cash, amount: '5', categoryId: label.body!.data.id });
    assert.equal(transfer.body!.data.category?.id, label.body!.data.id);
    const cleared = await api.call('PATCH', `/transactions/${transfer.body!.data.id}`, { token: user.token, body: { categoryId: null } });
    assert.deepEqual([cleared.status, cleared.body?.data.category], [200, null]);
  });

  it('TXN-US-07: audits a correction as TRANSACTION_UPDATED naming the changed fields', async () => {
    const user = await registerProbeUser(api, 'txn-audit');
    const account = await createAccount(api, user, user.walletId, { initialBalance: '100' });
    const food = await categoryOf(api, user, user.walletId, 'EXPENSE');
    const id = (await transact(user, { type: 'EXPENSE', fromAccountId: account, categoryId: food, amount: '5' })).body!.data.id as string;

    const edited = await api.call('PATCH', `/transactions/${id}`, { token: user.token, body: { description: 'probe fixed', reference: 'probe-ref' } });
    assert.equal(edited.status, 200);
    const audit = await api.sql<{ actor_id: string; wallet_id: string; note: string }>(
      'SELECT actor_id, wallet_id, note FROM audit_logs WHERE entity_id = $1 AND event = $2',
      [id, 'TRANSACTION_UPDATED'],
    );
    assert.equal(audit.length, 1);
    assert.deepEqual([audit[0]!.actor_id, audit[0]!.wallet_id], [user.id, user.walletId]);
    assert.deepEqual(audit[0]!.note.split(/,\s*/).sort(), ['description', 'reference']);
  });

  it('TXN-US-08: deleting the transaction backing a goal contribution removes the contribution and lowers goal progress', async () => {
    const user = await registerProbeUser(api, 'txn-goal');
    const account = await createAccount(api, user, user.walletId, { initialBalance: '5000' });
    const food = await categoryOf(api, user, user.walletId, 'EXPENSE');
    const goal = await api.call('POST', '/goals', { token: user.token, body: { walletId: user.walletId, name: `probe-${randomUUID()}`, targetAmount: '1000', currency: 'VND' } });
    const goalId = goal.body!.data.id as string;
    const contribution = await api.call('POST', `/goals/${goalId}/contributions`, {
      token: user.token,
      body: { accountId: account, amount: '250', currency: 'VND', contributionDate: IN_PERIOD, recordAsTransaction: true, categoryId: food },
    });
    assert.equal(contribution.status, 201);
    const transactionId = contribution.body!.data.transactionId as string;
    assert.equal((await api.call('GET', `/goals/${goalId}`, { token: user.token })).body!.data.currentAmount, '250.0000');

    const deleted = await api.call('POST', `/transactions/${transactionId}/delete`, { token: user.token, body: {} });
    assert.deepEqual([deleted.status, deleted.body?.data.status], [200, 'DELETED']);

    assert.deepEqual(await api.sql('SELECT id FROM goal_contributions WHERE id = $1', [contribution.body!.data.id]), []);
    const listed = await api.call('GET', `/goals/${goalId}/contributions`, { token: user.token });
    assert.deepEqual(listed.body!.data, []);
    const fallen = (await api.call('GET', `/goals/${goalId}`, { token: user.token })).body!.data;
    assert.deepEqual([fallen.currentAmount, fallen.progressPercentage, fallen.contributionCount], ['0.0000', 0, 0]);
    assert.equal((await api.call('GET', `/accounts/${account}`, { token: user.token })).body!.data.balance, '5000.0000');
  });
});
