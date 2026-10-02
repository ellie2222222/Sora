import { strict as assert } from 'node:assert';
import { randomUUID } from 'node:crypto';
import { after, before, describe, it } from 'node:test';

import { add, formatMoney, parseMoney } from '@sora/contracts';

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

/** A fixed month so the dashboard period is independent of when the suite runs. */
const PERIOD = { dateFrom: '2026-05-01', dateTo: '2026-05-31' };
const IN_PERIOD = '2026-05-10T09:00:00.000Z';
const BEFORE_PERIOD = '2026-04-20T09:00:00.000Z';

/** Balances, BR-02/03/06/07 and the dashboard, computed by the real SQL and read back over HTTP. */
describe('the ledger against a real database', { skip: integrationSkipReason() }, () => {
  let api: TestApi;
  let owner: ProbeUser;
  let walletA = '';
  let walletB = '';
  let bank = '';
  let cash = '';
  let savings = '';
  let food = '';

  async function transact(body: Record<string, unknown>, user: ProbeUser = owner) {
    return api.call('POST', '/transactions', { token: user.token, body: { currency: 'VND', transactionDate: IN_PERIOD, ...body } });
  }

  async function balanceOf(accountId: string, user: ProbeUser = owner): Promise<string> {
    return (await api.call('GET', `/accounts/${accountId}`, { token: user.token })).body!.data.balance;
  }

  before(async () => {
    api = await startTestApi();
    owner = await registerProbeUser(api, 'ledger');
    walletA = owner.walletId;
    const second = await api.call('POST', '/wallets', { token: owner.token, body: { name: `probe-${randomUUID()}` } });
    walletB = second.body!.data.id;
    bank = await createAccount(api, owner, walletA, { initialBalance: '20000000' });
    cash = await createAccount(api, owner, walletA);
    savings = await createAccount(api, owner, walletB);
    food = await categoryOf(api, owner, walletA, 'EXPENSE');
  });

  after(async () => {
    await api?.close();
  });

  it('derives balances from completed transactions only: pending and deleted ones move nothing', async () => {
    const account = await createAccount(api, owner, walletA, { initialBalance: '1000' });
    await transact({ type: 'EXPENSE', fromAccountId: account, categoryId: food, amount: '100.5' });
    await transact({ type: 'EXPENSE', fromAccountId: account, categoryId: food, amount: '300', status: 'PENDING' });
    const deleted = await transact({ type: 'EXPENSE', fromAccountId: account, categoryId: food, amount: '200' });
    await api.call('POST', `/transactions/${deleted.body!.data.id}/delete`, { token: owner.token, body: {} });

    assert.equal(await balanceOf(account), '899.5000');
    const detail = (await api.call('GET', `/accounts/${account}`, { token: owner.token })).body!.data;
    assert.equal(detail.totalExpense, '100.5000');
    assert.equal(detail.transactionCount, 3, 'every row counts, deleted included (§16.3)');
  });

  it('keeps every digit of the largest amount DECIMAL(19,4) allows (rule 1)', async () => {
    const account = await createAccount(api, owner, walletA, { initialBalance: '999999999999999.9999' });
    assert.equal(await balanceOf(account), '999999999999999.9999');
  });

  it('records a cross-wallet transfer once, moves both balances, and audits it against each wallet (BR-02, LA-02)', async () => {
    const response = await transact({ type: 'TRANSFER', fromAccountId: bank, toAccountId: savings, amount: '500000' });
    assert.equal(response.status, 201);
    assert.equal(response.body!.data.isCrossWallet, true);

    const audit = await api.sql<{ wallet_id: string }>(
      'SELECT wallet_id FROM audit_logs WHERE entity_id = $1 AND event = $2 ORDER BY wallet_id',
      [response.body!.data.id, 'TRANSACTION_CREATED'],
    );
    assert.deepEqual(audit.map((row) => row.wallet_id).sort(), [walletA, walletB].sort());
    assert.equal(await balanceOf(savings), '500000.0000');

    const listedInB = await api.call('GET', `/transactions?walletId=${walletB}`, { token: owner.token });
    assert.ok(listedInB.body!.data.some((row: { id: string }) => row.id === response.body!.data.id), 'visible from the receiving wallet');
  });

  it('refuses a transfer into a wallet where the caller is only a VIEWER, and into one they cannot see', async () => {
    const partner = await registerProbeUser(api, 'ledger-partner');
    const partnerAccount = await createAccount(api, partner, partner.walletId);
    const hidden = await createAccount(api, partner, partner.walletId);
    const before = await balanceOf(bank);

    const unseen = await transact({ type: 'TRANSFER', fromAccountId: bank, toAccountId: hidden, amount: '1' });
    assert.deepEqual([unseen.status, unseen.body?.error?.code], [404, 'ACCOUNT_NOT_FOUND']);

    await addMember(api, partner, partner.walletId, owner, 'VIEWER');
    const readOnly = await transact({ type: 'TRANSFER', fromAccountId: bank, toAccountId: partnerAccount, amount: '1' });
    assert.deepEqual([readOnly.status, readOnly.body?.error?.code], [403, 'FORBIDDEN']);
    assert.equal(await balanceOf(bank), before, 'a refused transfer leaves no row and moves nothing');
  });

  it('TXN-US-04: refuses a transfer pulling money out of a wallet where the caller is only a VIEWER (BR-02)', async () => {
    const partner = await registerProbeUser(api, 'ledger-source');
    const partnerAccount = await createAccount(api, partner, partner.walletId, { initialBalance: '1000' });
    await addMember(api, partner, partner.walletId, owner, 'VIEWER');
    const bankBefore = await balanceOf(bank);

    const pulled = await transact({ type: 'TRANSFER', fromAccountId: partnerAccount, toAccountId: bank, amount: '1' });
    assert.deepEqual([pulled.status, pulled.body?.error?.code], [403, 'FORBIDDEN'], 'EDITOR on the destination does not cover the source');
    assert.equal(await balanceOf(bank), bankBefore);
    assert.equal(await balanceOf(partnerAccount, partner), '1000.0000');
  });

  it('TXN-US-08: refuses to delete a cross-wallet transfer as a VIEWER on either side (BR-02)', async () => {
    const created = await transact({ type: 'TRANSFER', fromAccountId: bank, toAccountId: savings, amount: '3' });
    const id = created.body!.data.id as string;
    const helper = await registerProbeUser(api, 'ledger-half-editor');
    await addMember(api, owner, walletA, helper, 'EDITOR');
    await addMember(api, owner, walletB, helper, 'VIEWER');

    const refused = await api.call('POST', `/transactions/${id}/delete`, { token: helper.token, body: {} });
    assert.deepEqual([refused.status, refused.body?.error?.code], [403, 'FORBIDDEN']);
    const [row] = await api.sql<{ status: string }>('SELECT status FROM transactions WHERE id = $1', [id]);
    assert.equal(row?.status, 'COMPLETED', 'nothing changes on either wallet');
  });

  it('TXN-US-01/04: refuses entries on an archived account or into an archived wallet, and leaves no row', async () => {
    const description = `probe-archived-${randomUUID()}`;
    const retired = await createAccount(api, owner, walletA);
    assert.equal((await api.call('DELETE', `/accounts/${retired}`, { token: owner.token })).status, 204);
    const onArchivedAccount = await transact({ type: 'EXPENSE', fromAccountId: retired, categoryId: food, amount: '1', description });
    assert.deepEqual([onArchivedAccount.status, onArchivedAccount.body?.error?.code], [409, 'ACCOUNT_ARCHIVED']);

    const closedWallet = await api.call('POST', '/wallets', { token: owner.token, body: { name: `probe-${randomUUID()}` } });
    const closedAccount = await createAccount(api, owner, closedWallet.body!.data.id);
    assert.equal((await api.call('DELETE', `/wallets/${closedWallet.body!.data.id}`, { token: owner.token })).status, 204);
    const intoArchivedWallet = await transact({ type: 'TRANSFER', fromAccountId: bank, toAccountId: closedAccount, amount: '1', description });
    assert.deepEqual([intoArchivedWallet.status, intoArchivedWallet.body?.error?.code], [409, 'WALLET_ARCHIVED']);

    assert.deepEqual(await api.sql('SELECT id FROM transactions WHERE description = $1', [description]), []);
  });

  it('WAL-US-12: keeps an archived wallet readable and renamable, refuses new entries, and audits both', async () => {
    const user = await registerProbeUser(api, 'ledger-archive-wallet');
    const mine = await createAccount(api, user, user.walletId, { initialBalance: '100' });
    const shelved = (await api.call('POST', '/wallets', { token: user.token, body: { name: `probe-${randomUUID()}` } })).body!.data.id as string;
    const shelvedAccount = await createAccount(api, user, shelved);
    const transfer = await api.call('POST', '/transactions', {
      token: user.token,
      body: { type: 'TRANSFER', fromAccountId: mine, toAccountId: shelvedAccount, amount: '40', currency: 'VND', transactionDate: IN_PERIOD },
    });
    assert.equal(transfer.status, 201);

    assert.equal((await api.call('DELETE', `/wallets/${shelved}`, { token: user.token })).status, 204);
    const read = await api.call('GET', `/wallets/${shelved}`, { token: user.token });
    assert.deepEqual([read.status, read.body?.data.status], [200, 'ARCHIVED']);
    assert.equal((await api.call('GET', `/accounts/${shelvedAccount}`, { token: user.token })).body!.data.balance, '40.0000');
    const fromOtherSide = await api.call('GET', `/transactions?walletId=${user.walletId}`, { token: user.token });
    assert.ok(fromOtherSide.body!.data.some((row: { id: string }) => row.id === transfer.body!.data.id), 'the cross-wallet transfer stays visible');

    const newAccount = await api.call('POST', '/accounts', { token: user.token, body: { walletId: shelved, name: `probe-${randomUUID()}`, type: 'BANK_ACCOUNT', currency: 'VND', initialBalance: '0' } });
    assert.deepEqual([newAccount.status, newAccount.body?.error?.code], [409, 'WALLET_ARCHIVED']);
    const outOf = await api.call('POST', '/transactions', {
      token: user.token,
      body: { type: 'TRANSFER', fromAccountId: shelvedAccount, toAccountId: mine, amount: '1', currency: 'VND', transactionDate: IN_PERIOD },
    });
    assert.deepEqual([outOf.status, outOf.body?.error?.code], [409, 'WALLET_ARCHIVED']);

    const renamed = await api.call('PATCH', `/wallets/${shelved}`, { token: user.token, body: { name: 'probe-renamed' } });
    assert.deepEqual([renamed.status, renamed.body?.data.name, renamed.body?.data.status], [200, 'probe-renamed', 'ARCHIVED']);
    const audit = await api.sql<{ event: string }>('SELECT event FROM audit_logs WHERE entity_id = $1 ORDER BY created_at', [shelved]);
    assert.ok(['WALLET_ARCHIVED', 'WALLET_UPDATED'].every((event) => audit.some((row) => row.event === event)));
  });

  it('records one transaction for two concurrent creates sharing an Idempotency-Key (API spec §2.10)', async () => {
    const description = `probe-idem-${randomUUID()}`;
    const send = () =>
      api.call('POST', '/transactions', {
        token: owner.token,
        headers: { 'Idempotency-Key': description },
        body: { type: 'EXPENSE', fromAccountId: cash, categoryId: food, amount: '7', currency: 'VND', transactionDate: IN_PERIOD, description },
      });
    const [first, retry] = await Promise.all([send(), send()]);
    assert.deepEqual([first.status, retry.status], [201, 201]);
    assert.equal(retry.body!.data.id, first.body!.data.id, 'the retry gets the original response');
    const rows = await api.sql('SELECT id FROM transactions WHERE description = $1', [description]);
    assert.equal(rows.length, 1);
  });

  it('refuses a transaction whose currency differs from its account (BR-07)', async () => {
    const response = await transact({ type: 'EXPENSE', fromAccountId: bank, categoryId: food, amount: '1', currency: 'USD' });
    assert.equal(response.status, 422);
    assert.equal(response.body?.error?.code, 'ACCOUNT_CURRENCY_MISMATCH');
  });

  it('refuses to edit amount, type or accounts, allows the descriptive fields, and deletes by status (BR-03)', async () => {
    const created = await transact({ type: 'EXPENSE', fromAccountId: cash, categoryId: food, amount: '5' });
    const id = created.body!.data.id as string;

    for (const field of [{ amount: '1' }, { type: 'INCOME' }, { fromAccountId: bank }]) {
      const edit = await api.call('PATCH', `/transactions/${id}`, { token: owner.token, body: field });
      assert.deepEqual([edit.status, edit.body?.error?.code], [409, 'TRANSACTION_IMMUTABLE'], `PATCH ${JSON.stringify(field)}`);
      const [row] = await api.sql<{ amount: string; type: string }>('SELECT amount::text, type FROM transactions WHERE id = $1', [id]);
      assert.deepEqual(row, { amount: '5.0000', type: 'EXPENSE' });
    }
    const described = await api.call('PATCH', `/transactions/${id}`, { token: owner.token, body: { description: 'probe note' } });
    assert.equal(described.body?.data.description, 'probe note');

    const cashBefore = await balanceOf(cash);
    const deleted = await api.call('POST', `/transactions/${id}/delete`, { token: owner.token, body: { reason: 'probe' } });
    assert.equal(deleted.body?.data.status, 'DELETED');
    const [kept] = await api.sql<{ status: string }>('SELECT status FROM transactions WHERE id = $1', [id]);
    assert.equal(kept?.status, 'DELETED', 'the row stays (Data Safety)');
    assert.equal(await balanceOf(cash), formatMoney(add(parseMoney(cashBefore), parseMoney('5'))), 'deleting gives the money back');

    const again = await api.call('POST', `/transactions/${id}/delete`, { token: owner.token, body: {} });
    assert.equal(again.status, 409);
    const editDeleted = await api.call('PATCH', `/transactions/${id}`, { token: owner.token, body: { description: 'x' } });
    assert.equal(editDeleted.status, 409);
  });

  it('reports a transfer as neither income nor expense on the dashboard, per currency (BR-06)', async () => {
    const user = await registerProbeUser(api, 'ledger-dash');
    const other = await api.call('POST', '/wallets', { token: user.token, body: { name: `probe-${randomUUID()}` } });
    const main = await createAccount(api, user, user.walletId, { initialBalance: '0' });
    const wallet = await createAccount(api, user, user.walletId);
    const elsewhere = await createAccount(api, user, other.body!.data.id);
    const usd = await createAccount(api, user, user.walletId, { currency: 'USD', initialBalance: '10' });
    const dashFood = await categoryOf(api, user, user.walletId, 'EXPENSE');
    const dashSalary = await categoryOf(api, user, user.walletId, 'INCOME');
    const post = (body: Record<string, unknown>) =>
      api.call('POST', '/transactions', { token: user.token, body: { currency: 'VND', transactionDate: IN_PERIOD, ...body } });

    await post({ type: 'INCOME', toAccountId: main, categoryId: dashSalary, amount: '15000000' });
    await post({ type: 'EXPENSE', fromAccountId: main, categoryId: dashFood, amount: '150000' });
    await post({ type: 'TRANSFER', fromAccountId: main, toAccountId: wallet, amount: '2000000' });
    await post({ type: 'TRANSFER', fromAccountId: main, toAccountId: elsewhere, amount: '500000' });
    await post({ type: 'EXPENSE', fromAccountId: usd, categoryId: dashFood, amount: '2.5', currency: 'USD' });
    await post({ type: 'EXPENSE', fromAccountId: main, categoryId: dashFood, amount: '999', transactionDate: BEFORE_PERIOD });
    const deleted = await post({ type: 'EXPENSE', fromAccountId: main, categoryId: dashFood, amount: '700000' });
    await api.call('POST', `/transactions/${deleted.body!.data.id}/delete`, { token: user.token, body: {} });

    const response = await api.call('GET', `/dashboard?walletId=${user.walletId}&dateFrom=${PERIOD.dateFrom}&dateTo=${PERIOD.dateTo}`, { token: user.token });
    assert.equal(response.status, 200);
    const dash = response.body!.data;
    assert.deepEqual(dash.income, [{ currency: 'VND', amount: '15000000.0000' }]);
    assert.deepEqual(dash.expense, [
      { currency: 'USD', amount: '2.5000' },
      { currency: 'VND', amount: '150000.0000' },
    ]);
    assert.deepEqual(dash.net, [
      { currency: 'USD', amount: '-2.5000' },
      { currency: 'VND', amount: '14850000.0000' },
    ]);
    assert.deepEqual(dash.transferredOut, [{ currency: 'VND', amount: '500000.0000' }], 'only the transfer that left the wallet');
    assert.deepEqual(dash.transferredIn, []);
    assert.deepEqual(
      dash.totalBalance,
      [
        { currency: 'USD', amount: '7.5000' },
        { currency: 'VND', amount: '14349001.0000' },
      ],
      'every completed movement, including the one before the period',
    );
    assert.deepEqual(
      dash.spendingByCategory.map((slice: { amount: string; percentage: number }) => [slice.amount, slice.percentage]),
      [['150000.0000', 100]],
      'scoped to the dominant expense currency',
    );
  });

  it('scopes the dashboard to one account: a sibling-account transfer is its in/out, never income or expense', async () => {
    const user = await registerProbeUser(api, 'ledger-acct-dash');
    const other = await api.call('POST', '/wallets', { token: user.token, body: { name: `probe-${randomUUID()}` } });
    const main = await createAccount(api, user, user.walletId, { initialBalance: '1000000' });
    const cashBox = await createAccount(api, user, user.walletId, { initialBalance: '0' });
    const foreign = await createAccount(api, user, other.body!.data.id);
    const dashFood = await categoryOf(api, user, user.walletId, 'EXPENSE');
    const post = (body: Record<string, unknown>) =>
      api.call('POST', '/transactions', { token: user.token, body: { currency: 'VND', transactionDate: IN_PERIOD, ...body } });

    await post({ type: 'EXPENSE', fromAccountId: main, categoryId: dashFood, amount: '100000' });
    await post({ type: 'TRANSFER', fromAccountId: main, toAccountId: cashBox, amount: '300000' });
    await post({ type: 'EXPENSE', fromAccountId: cashBox, categoryId: dashFood, amount: '50000' });

    const query = `walletId=${user.walletId}&dateFrom=${PERIOD.dateFrom}&dateTo=${PERIOD.dateTo}`;
    const response = await api.call('GET', `/dashboard?${query}&accountId=${cashBox}`, { token: user.token });
    assert.equal(response.status, 200);
    const dash = response.body!.data;
    assert.deepEqual(dash.expense, [{ currency: 'VND', amount: '50000.0000' }], "only this account's own expense");
    assert.deepEqual(dash.income, []);
    assert.deepEqual(dash.transferredIn, [{ currency: 'VND', amount: '300000.0000' }], 'the sibling transfer crossed this account');
    assert.deepEqual(dash.transferredOut, []);
    assert.deepEqual(dash.totalBalance, [{ currency: 'VND', amount: '250000.0000' }]);
    assert.equal(dash.recentTransactions.length, 2);
    assert.deepEqual([dash.activeBudgets, dash.activeGoals], [[], []], 'budgets and goals belong to the wallet');

    const wholeWallet = (await api.call('GET', `/dashboard?${query}`, { token: user.token })).body!.data;
    assert.deepEqual(wholeWallet.transferredIn, [], 'internal to the wallet, so neither in nor out at wallet level');

    const outside = await api.call('GET', `/dashboard?${query}&accountId=${foreign}`, { token: user.token });
    assert.deepEqual([outside.status, outside.body?.error?.code], [404, 'ACCOUNT_NOT_FOUND']);
  });
});
