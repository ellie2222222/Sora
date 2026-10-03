import { strict as assert } from 'node:assert';
import { randomUUID } from 'node:crypto';
import { after, before, describe, it } from 'node:test';

import { sql } from 'kysely';

import {
  addMember,
  categoryOf,
  createAccount,
  integrationSkipReason,
  registerProbeUser,
  startTestApi,
  whileHeld,
  type ProbeUser,
  type TestApi,
} from './support/integration.ts';

const WHEN = '2026-05-10T09:00:00.000Z';

/** API spec §9 accounts over HTTP: create, list, detail totals, correction and archive. */
describe('accounts against a real database', { skip: integrationSkipReason() }, () => {
  let api: TestApi;

  const newWallet = async (user: ProbeUser): Promise<string> =>
    (await api.call('POST', '/wallets', { token: user.token, body: { name: `probe-${randomUUID()}` } })).body!.data.id;

  const transact = (user: ProbeUser, body: Record<string, unknown>) =>
    api.call('POST', '/transactions', { token: user.token, body: { currency: 'VND', transactionDate: WHEN, ...body } });

  const auditEvents = async (entityId: string): Promise<{ event: string; actor_id: string; wallet_id: string }[]> =>
    api.sql('SELECT event, actor_id, wallet_id FROM audit_logs WHERE entity_id = $1 ORDER BY id', [entityId]);

  before(async () => {
    api = await startTestApi();
  });

  after(async () => {
    await api?.close();
  });

  it('ACC-US-01: opens a credit card in debt and defaults an omitted opening balance to 0 (VL-04)', async () => {
    const user = await registerProbeUser(api, 'acc-open');
    const card = await api.call('POST', '/accounts', {
      token: user.token,
      body: { walletId: user.walletId, name: `probe-${randomUUID()}`, type: 'CREDIT_CARD', currency: 'VND', initialBalance: '-2500000.5' },
    });
    assert.equal(card.status, 201);
    assert.deepEqual([card.body!.data.initialBalance, card.body!.data.balance], ['-2500000.5000', '-2500000.5000']);
    const [stored] = await api.sql<{ initial_balance: string }>('SELECT initial_balance::text FROM accounts WHERE id = $1', [card.body!.data.id]);
    assert.equal(stored?.initial_balance, '-2500000.5000');

    const plain = await api.call('POST', '/accounts', {
      token: user.token,
      body: { walletId: user.walletId, name: `probe-${randomUUID()}`, type: 'CASH', currency: 'VND' },
    });
    assert.equal(plain.status, 201);
    assert.deepEqual([plain.body!.data.initialBalance, plain.body!.data.balance], ['0.0000', '0.0000']);
  });

  it('ACC-US-01: refuses an account in an archived wallet, and audits a successful create', async () => {
    const user = await registerProbeUser(api, 'acc-create');
    const created = await api.call('POST', '/accounts', {
      token: user.token,
      body: { walletId: user.walletId, name: `probe-${randomUUID()}`, type: 'BANK_ACCOUNT', currency: 'VND', initialBalance: '0' },
    });
    assert.equal(created.status, 201);
    const audit = await auditEvents(created.body!.data.id);
    assert.deepEqual(audit, [{ event: 'ACCOUNT_CREATED', actor_id: user.id, wallet_id: user.walletId }]);

    const shelved = await newWallet(user);
    assert.equal((await api.call('DELETE', `/wallets/${shelved}`, { token: user.token })).status, 204);
    const name = `probe-${randomUUID()}`;
    const refused = await api.call('POST', '/accounts', {
      token: user.token,
      body: { walletId: shelved, name, type: 'BANK_ACCOUNT', currency: 'VND', initialBalance: '0' },
    });
    assert.deepEqual([refused.status, refused.body?.error?.code], [409, 'WALLET_ARCHIVED']);
    assert.deepEqual(await api.sql('SELECT id FROM accounts WHERE name = $1', [name]), []);
  });

  it('ACC-US-02: lists every reachable wallet, one wallet, filtered by status and type, and 404s a hidden wallet', async () => {
    const user = await registerProbeUser(api, 'acc-list');
    const partner = await registerProbeUser(api, 'acc-list-partner');
    const second = await newWallet(user);
    const own = await createAccount(api, user, user.walletId, { initialBalance: '1000' });
    const secondBank = await createAccount(api, user, second);
    const secondCash = (
      await api.call('POST', '/accounts', {
        token: user.token,
        body: { walletId: second, name: `probe-${randomUUID()}`, type: 'CASH', currency: 'VND', initialBalance: '0' },
      })
    ).body!.data.id as string;
    const shared = await createAccount(api, partner, partner.walletId);
    const hidden = await createAccount(api, partner, await newWallet(partner));
    await addMember(api, partner, partner.walletId, user, 'VIEWER');
    assert.equal((await api.call('DELETE', `/accounts/${secondCash}`, { token: user.token })).status, 204);
    const food = await categoryOf(api, user, user.walletId, 'EXPENSE');
    assert.equal((await transact(user, { type: 'EXPENSE', fromAccountId: own, categoryId: food, amount: '250.25' })).status, 201);

    const ids = (response: { body: { data: { id: string }[] } | null }) => response.body!.data.map((row) => row.id);

    const everywhere = await api.call('GET', '/accounts', { token: user.token });
    assert.equal(everywhere.status, 200);
    for (const id of [own, secondBank, secondCash, shared]) assert.ok(ids(everywhere).includes(id), `reachable account ${id} listed`);
    assert.ok(!ids(everywhere).includes(hidden), 'a wallet without membership contributes nothing');
    const ownRow = everywhere.body!.data.find((row: { id: string }) => row.id === own);
    assert.equal(ownRow.balance, '749.7500', 'balance is derived from the ledger, not the opening amount');

    const oneWallet = await api.call('GET', `/accounts?walletId=${second}`, { token: user.token });
    assert.deepEqual(ids(oneWallet).sort(), [secondBank, secondCash].sort());

    const active = await api.call('GET', `/accounts?walletId=${second}&status=ACTIVE`, { token: user.token });
    assert.deepEqual(ids(active), [secondBank]);
    const archived = await api.call('GET', `/accounts?walletId=${second}&status=ARCHIVED`, { token: user.token });
    assert.deepEqual(ids(archived), [secondCash]);
    const cashOnly = await api.call('GET', `/accounts?walletId=${second}&type=CASH`, { token: user.token });
    assert.deepEqual(ids(cashOnly), [secondCash]);

    const partnerHidden = (await api.sql<{ wallet_id: string }>('SELECT wallet_id FROM accounts WHERE id = $1', [hidden]))[0]!.wallet_id;
    for (const walletId of [partnerHidden, randomUUID()]) {
      const refused = await api.call('GET', `/accounts?walletId=${walletId}`, { token: user.token });
      assert.deepEqual([refused.status, refused.body?.error?.code], [404, 'WALLET_NOT_FOUND']);
    }
  });

  it('ACC-US-03: reports income, expense, transfers in and out separately, and counts deleted rows (BR-06)', async () => {
    const user = await registerProbeUser(api, 'acc-detail');
    const other = await newWallet(user);
    const account = await createAccount(api, user, user.walletId, { initialBalance: '1000' });
    const sibling = await createAccount(api, user, user.walletId, { initialBalance: '500' });
    const elsewhere = await createAccount(api, user, other, { initialBalance: '500' });
    const food = await categoryOf(api, user, user.walletId, 'EXPENSE');
    const salary = await categoryOf(api, user, user.walletId, 'INCOME');

    await transact(user, { type: 'INCOME', toAccountId: account, categoryId: salary, amount: '300' });
    await transact(user, { type: 'EXPENSE', fromAccountId: account, categoryId: food, amount: '40.5' });
    await transact(user, { type: 'TRANSFER', fromAccountId: account, toAccountId: sibling, amount: '100' });
    await transact(user, { type: 'TRANSFER', fromAccountId: account, toAccountId: elsewhere, amount: '25' });
    await transact(user, { type: 'TRANSFER', fromAccountId: elsewhere, toAccountId: account, amount: '60' });
    const deleted = await transact(user, { type: 'EXPENSE', fromAccountId: account, categoryId: food, amount: '9999' });
    await api.call('POST', `/transactions/${deleted.body!.data.id}/delete`, { token: user.token, body: {} });

    const detail = await api.call('GET', `/accounts/${account}`, { token: user.token });
    assert.equal(detail.status, 200);
    const data = detail.body!.data;
    assert.deepEqual(
      [data.totalIncome, data.totalExpense, data.transferredIn, data.transferredOut],
      ['300.0000', '40.5000', '60.0000', '125.0000'],
    );
    assert.equal(data.transactionCount, 6, 'the deleted row is still counted (§16.3)');
    assert.equal(data.balance, '1194.5000');
  });

  it('ACC-US-04: renames and audits; refuses to change type or opening balance', async () => {
    const user = await registerProbeUser(api, 'acc-patch');
    const account = await createAccount(api, user, user.walletId, { initialBalance: '100' });

    const renamed = await api.call('PATCH', `/accounts/${account}`, { token: user.token, body: { name: 'probe-renamed' } });
    assert.deepEqual([renamed.status, renamed.body?.data.name], [200, 'probe-renamed']);
    assert.ok((await auditEvents(account)).some((row) => row.event === 'ACCOUNT_UPDATED' && row.actor_id === user.id));

    for (const field of [{ type: 'CASH' }, { initialBalance: '999' }, { name: 'probe-renamed-again', type: 'CASH', initialBalance: '999' }]) {
      await api.call('PATCH', `/accounts/${account}`, { token: user.token, body: field });
      const [row] = await api.sql<{ type: string; initial_balance: string; currency: string }>(
        'SELECT type, initial_balance::text, currency FROM accounts WHERE id = $1',
        [account],
      );
      assert.deepEqual(row, { type: 'BANK_ACCOUNT', initial_balance: '100.0000', currency: 'VND' }, `PATCH ${JSON.stringify(field)}`);
    }
  });

  it('ACC-US-04: changes currency only while nothing names the account: no transaction, no earmark (API spec §9.4)', async () => {
    const user = await registerProbeUser(api, 'acc-patch-currency');
    const currencyOf = async (id: string) => (await api.sql<{ currency: string }>('SELECT currency FROM accounts WHERE id = $1', [id]))[0]?.currency;
    const switchToUsd = (id: string) => api.call('PATCH', `/accounts/${id}`, { token: user.token, body: { currency: 'USD' } });

    const empty = await createAccount(api, user, user.walletId);
    assert.equal((await switchToUsd(empty)).status, 200);
    assert.equal(await currencyOf(empty), 'USD');

    const spent = await createAccount(api, user, user.walletId, { initialBalance: '100' });
    const food = await categoryOf(api, user, user.walletId, 'EXPENSE');
    const expense = await api.call('POST', '/transactions', {
      token: user.token,
      body: { type: 'EXPENSE', fromAccountId: spent, categoryId: food, amount: '1', currency: 'VND', transactionDate: WHEN },
    });
    assert.equal(expense.status, 201);

    const earmarked = await createAccount(api, user, user.walletId);
    const goal = await api.call('POST', '/goals', { token: user.token, body: { walletId: user.walletId, name: `probe-${randomUUID()}`, targetAmount: '100', currency: 'VND' } });
    const earmark = await api.call('POST', `/goals/${goal.body!.data.id}/contributions`, {
      token: user.token,
      body: { accountId: earmarked, amount: '5', currency: 'VND', contributionDate: WHEN },
    });
    assert.equal(earmark.status, 201);

    for (const id of [spent, earmarked]) {
      const refused = await switchToUsd(id);
      assert.deepEqual([refused.status, refused.body?.error?.code], [422, 'ACCOUNT_CURRENCY_MISMATCH']);
      assert.equal(await currencyOf(id), 'VND');
    }
  });

  describe('ACC-US-04: a currency change racing a write that names the account', () => {
    let user: ProbeUser;

    before(async () => {
      user = await registerProbeUser(api, 'acc-currency-race');
    });

    it('a transaction create waits for an in-flight currency change, then refuses the old currency', async () => {
      const account = await createAccount(api, user, user.walletId);
      const salary = await categoryOf(api, user, user.walletId, 'INCOME');
      const { waited, result: refused } = await whileHeld(
        api,
        async (trx) => {
          await sql`SELECT id FROM accounts WHERE id = ${account} FOR UPDATE`.execute(trx);
          await sql`UPDATE accounts SET currency = 'USD' WHERE id = ${account}`.execute(trx);
        },
        () => transact(user, { type: 'INCOME', toAccountId: account, categoryId: salary, amount: '1' }),
      );

      assert.equal(waited, true, 'the create must wait on the account row');
      assert.deepEqual([refused.status, refused.body?.error?.code], [422, 'ACCOUNT_CURRENCY_MISMATCH']);
      assert.deepEqual(await api.sql('SELECT id FROM transactions WHERE to_account_id = $1', [account]), []);
    });

    it('a currency change waits for an in-flight transaction create, then refuses', async () => {
      const account = await createAccount(api, user, user.walletId);
      const salary = await categoryOf(api, user, user.walletId, 'INCOME');
      const { waited, result: refused } = await whileHeld(
        api,
        async (trx) => {
          await sql`SELECT id FROM accounts WHERE id = ${account} FOR SHARE`.execute(trx);
          await sql`INSERT INTO transactions (created_by_user_id, to_account_id, category_id, type, amount, currency, transaction_date, status)
                    VALUES (${user.id}, ${account}, ${salary}, 'INCOME', 1, 'VND', ${WHEN}, 'COMPLETED')`.execute(trx);
        },
        () => api.call('PATCH', `/accounts/${account}`, { token: user.token, body: { currency: 'USD' } }),
      );

      assert.equal(waited, true, 'the change must wait on the account row');
      assert.deepEqual([refused.status, refused.body?.error?.code], [422, 'ACCOUNT_CURRENCY_MISMATCH']);
      assert.deepEqual(await api.sql('SELECT currency FROM accounts WHERE id = $1', [account]), [{ currency: 'VND' }]);
    });
  });

  it('ACC-US-05: archives with 204, then refuses new transactions on the account', async () => {
    const user = await registerProbeUser(api, 'acc-archive');
    const keep = await createAccount(api, user, user.walletId);
    const retired = await createAccount(api, user, user.walletId);
    const food = await categoryOf(api, user, user.walletId, 'EXPENSE');
    const salary = await categoryOf(api, user, user.walletId, 'INCOME');
    const description = `probe-archived-${randomUUID()}`;

    const archived = await api.call('DELETE', `/accounts/${retired}`, { token: user.token });
    assert.equal(archived.status, 204);

    for (const body of [
      { type: 'EXPENSE', fromAccountId: retired, categoryId: food, amount: '1', description },
      { type: 'INCOME', toAccountId: retired, categoryId: salary, amount: '1', description },
      { type: 'TRANSFER', fromAccountId: keep, toAccountId: retired, amount: '1', description },
    ]) {
      const refused = await transact(user, body);
      assert.deepEqual([refused.status, refused.body?.error?.code], [409, 'ACCOUNT_ARCHIVED'], `${body.type}`);
    }
    assert.deepEqual(await api.sql('SELECT id FROM transactions WHERE description = $1', [description]), []);
  });

  it('ACC-US-05: keeps an archived account listed, readable and audited, with its cross-wallet transfers resolving both sides', async () => {
    const user = await registerProbeUser(api, 'acc-history');
    const other = await newWallet(user);
    const keep = await createAccount(api, user, user.walletId);
    const retired = await createAccount(api, user, user.walletId, { initialBalance: '1000' });
    const elsewhere = await createAccount(api, user, other);
    const transfer = await transact(user, { type: 'TRANSFER', fromAccountId: retired, toAccountId: elsewhere, amount: '400' });
    assert.equal(transfer.status, 201);

    assert.equal((await api.call('DELETE', `/accounts/${retired}`, { token: user.token })).status, 204);
    assert.ok((await auditEvents(retired)).some((row) => row.event === 'ACCOUNT_ARCHIVED' && row.actor_id === user.id));

    const listed = await api.call('GET', `/accounts?walletId=${user.walletId}`, { token: user.token });
    const row = listed.body!.data.find((account: { id: string }) => account.id === retired);
    assert.deepEqual([row?.status, row?.balance], ['ARCHIVED', '600.0000']);
    assert.ok(listed.body!.data.some((account: { id: string }) => account.id === keep));

    const detail = await api.call('GET', `/accounts/${retired}`, { token: user.token });
    assert.deepEqual([detail.status, detail.body?.data.status, detail.body?.data.transferredOut], [200, 'ARCHIVED', '400.0000']);

    const past = await api.call('GET', `/transactions/${transfer.body!.data.id}`, { token: user.token });
    assert.equal(past.status, 200);
    assert.deepEqual(
      [past.body!.data.fromAccount?.id, past.body!.data.fromAccount?.walletId, past.body!.data.toAccount?.id, past.body!.data.toAccount?.walletId],
      [retired, user.walletId, elsewhere, other],
    );
    assert.equal(past.body!.data.isCrossWallet, true);
    const fromOtherSide = await api.call('GET', `/transactions?walletId=${other}`, { token: user.token });
    assert.ok(fromOtherSide.body!.data.some((txn: { id: string }) => txn.id === transfer.body!.data.id));
  });
});
