import { strict as assert } from 'node:assert';
import { randomUUID } from 'node:crypto';
import { after, before, describe, it } from 'node:test';

import { addMember, categoryOf, createAccount, integrationSkipReason, registerProbeUser, startTestApi, type ProbeUser, type TestApi } from './support/integration.ts';

/** Wallet calendar days (§2.11 time zones): every day, month and window is read in the wallet's zone. */
describe('wallet time zones against a real database', { skip: integrationSkipReason() }, () => {
  let api: TestApi;

  before(async () => {
    api = await startTestApi();
  });

  after(async () => {
    await api?.close();
  });

  async function walletIn(user: ProbeUser, timeZone: string) {
    const created = await api.call('POST', '/wallets', { token: user.token, body: { name: `probe-${randomUUID()}`, timeZone } });
    assert.equal(created.status, 201, JSON.stringify(created.body));
    assert.equal(created.body!.data.timeZone, timeZone);
    const walletId = created.body!.data.id as string;
    const account = await createAccount(api, user, walletId, { initialBalance: '1000000' });
    const category = await api.call('POST', '/categories', { token: user.token, body: { walletId, name: `probe-${randomUUID()}`, type: 'EXPENSE' } });
    return { walletId, account, category: category.body!.data.id as string };
  }

  const spend = (user: ProbeUser, account: string, category: string, transactionDate: string, amount = '1000') =>
    api.call('POST', '/transactions', {
      token: user.token,
      body: { type: 'EXPENSE', fromAccountId: account, categoryId: category, amount, currency: 'VND', transactionDate },
    });

  const expenseOf = async (user: ProbeUser, walletId: string, dateFrom: string, dateTo: string) => {
    const dashboard = await api.call('GET', `/dashboard?walletId=${walletId}&dateFrom=${dateFrom}&dateTo=${dateTo}`, { token: user.token });
    assert.equal(dashboard.status, 200, JSON.stringify(dashboard.body));
    return { amount: dashboard.body!.data.expense[0]?.amount ?? '0', period: dashboard.body!.data.period };
  };

  const listed = async (user: ProbeUser, walletId: string, day: string) => {
    const list = await api.call('GET', `/transactions?walletId=${walletId}&dateFrom=${day}&dateTo=${day}&pageSize=200`, { token: user.token });
    return (list.body!.data as { transactionDate: string }[]).map((row) => row.transactionDate);
  };

  it('refuses a wallet without an IANA zone, or with an offset', async () => {
    const user = await registerProbeUser(api, 'tz-invalid');
    for (const body of [{ name: 'probe-no-zone' }, { name: 'probe-offset', timeZone: '+07:00' }, { name: 'probe-unknown', timeZone: 'Vietnam/Hanoi' }]) {
      const response = await api.call('POST', '/wallets', { token: user.token, body });
      assert.equal(response.status, 422, JSON.stringify(body));
      assert.equal(response.body?.error?.code, 'VALIDATION_FAILED');
    }
  });

  it('files 23:30Z on Oct 31 under November 1 in Asia/Ho_Chi_Minh: list filter, dashboard month', async () => {
    const user = await registerProbeUser(api, 'tz-vn');
    const { walletId, account, category } = await walletIn(user, 'Asia/Ho_Chi_Minh');
    assert.equal((await spend(user, account, category, '2026-10-31T16:59:00.000Z', '1')).status, 201); // 23:59 Oct 31 local
    assert.equal((await spend(user, account, category, '2026-10-31T17:00:00.000Z', '10')).status, 201); // 00:00 Nov 1 local
    assert.equal((await spend(user, account, category, '2026-10-31T23:30:00.000Z', '100')).status, 201); // 06:30 Nov 1 local

    assert.deepEqual(await listed(user, walletId, '2026-11-01'), ['2026-10-31T23:30:00.000Z', '2026-10-31T17:00:00.000Z']);
    assert.deepEqual(await listed(user, walletId, '2026-10-31'), ['2026-10-31T16:59:00.000Z']);

    const november = await expenseOf(user, walletId, '2026-11-01', '2026-11-30');
    assert.equal(november.amount, '110.0000');
    assert.deepEqual(november.period, { dateFrom: '2026-11-01', dateTo: '2026-11-30', timeZone: 'Asia/Ho_Chi_Minh' });
    assert.equal((await expenseOf(user, walletId, '2026-10-01', '2026-10-31')).amount, '1.0000');
  });

  it('counts 23:30 local on Nov 30 toward a November budget and 00:30 local on Dec 1 toward none', async () => {
    const user = await registerProbeUser(api, 'tz-budget');
    const { walletId, account, category } = await walletIn(user, 'Asia/Ho_Chi_Minh');
    assert.equal((await spend(user, account, category, '2026-11-30T16:30:00.000Z', '300')).status, 201);
    assert.equal((await spend(user, account, category, '2026-11-30T17:30:00.000Z', '5000')).status, 201);

    const budget = await api.call('POST', '/budgets', {
      token: user.token,
      body: { walletId, categoryId: category, name: 'probe-nov', amount: '1000', currency: 'VND', periodType: 'CUSTOM', startDate: '2026-11-01', endDate: '2026-11-30' },
    });
    assert.equal(budget.status, 201, JSON.stringify(budget.body));
    assert.equal(budget.body!.data.spent, '300.0000');
    assert.equal(budget.body!.data.timeZone, 'Asia/Ho_Chi_Minh');
  });

  it('reads a negative-offset wallet (America/Los_Angeles) behind UTC', async () => {
    const user = await registerProbeUser(api, 'tz-la');
    const { walletId, account, category } = await walletIn(user, 'America/Los_Angeles');
    // 03:00Z on Nov 1 is 20:00 on Oct 31 in Los Angeles (PDT, UTC-7).
    assert.equal((await spend(user, account, category, '2026-11-01T03:00:00.000Z', '7')).status, 201);
    assert.equal((await expenseOf(user, walletId, '2026-10-01', '2026-10-31')).amount, '7.0000');
    assert.equal((await expenseOf(user, walletId, '2026-11-01', '2026-11-30')).amount, '0');
    assert.deepEqual(await listed(user, walletId, '2026-10-31'), ['2026-11-01T03:00:00.000Z']);
  });

  it('gives every member of a shared wallet the same days and totals', async () => {
    const owner = await registerProbeUser(api, 'tz-shared-owner');
    const viewer = await registerProbeUser(api, 'tz-shared-viewer');
    const { walletId, account, category } = await walletIn(owner, 'Asia/Ho_Chi_Minh');
    await addMember(api, owner, walletId, viewer, 'VIEWER');
    assert.equal((await spend(owner, account, category, '2026-10-31T23:30:00.000Z', '42')).status, 201);

    // The viewer's phone being elsewhere changes nothing: no request carries a device zone.
    const byOwner = await expenseOf(owner, walletId, '2026-11-01', '2026-11-30');
    const byViewer = await expenseOf(viewer, walletId, '2026-11-01', '2026-11-30');
    assert.deepEqual(byViewer, byOwner);
    assert.deepEqual(await listed(viewer, walletId, '2026-11-01'), await listed(owner, walletId, '2026-11-01'));
  });

  it('lets the owner change the zone, which re-files days without touching any stored instant', async () => {
    const owner = await registerProbeUser(api, 'tz-change');
    const editor = await registerProbeUser(api, 'tz-change-editor');
    const { walletId, account, category } = await walletIn(owner, 'Asia/Ho_Chi_Minh');
    await addMember(api, owner, walletId, editor, 'EDITOR');
    const created = await spend(owner, account, category, '2026-10-31T23:30:00.000Z', '9');
    const transactionId = created.body!.data.id as string;

    const refused = await api.call('PATCH', `/wallets/${walletId}`, { token: editor.token, body: { timeZone: 'America/Los_Angeles' } });
    assert.equal(refused.status, 403);

    const changed = await api.call('PATCH', `/wallets/${walletId}`, { token: owner.token, body: { timeZone: 'America/Los_Angeles' } });
    assert.equal(changed.status, 200);
    assert.equal(changed.body!.data.timeZone, 'America/Los_Angeles');

    assert.equal((await expenseOf(owner, walletId, '2026-10-01', '2026-10-31')).amount, '9.0000');
    const [stored] = await api.sql<{ transaction_date: Date }>('SELECT transaction_date FROM transactions WHERE id = $1', [transactionId]);
    assert.equal(stored!.transaction_date.toISOString(), '2026-10-31T23:30:00.000Z');
  });

  it('judges each row in its own wallet\'s zone when the list spans every wallet', async () => {
    const user = await registerProbeUser(api, 'tz-all');
    const vn = await walletIn(user, 'Asia/Ho_Chi_Minh');
    const la = await walletIn(user, 'America/Los_Angeles');
    assert.equal((await spend(user, vn.account, vn.category, '2026-10-31T23:30:00.000Z')).status, 201); // Nov 1 in VN
    assert.equal((await spend(user, la.account, la.category, '2026-11-01T03:00:00.000Z')).status, 201); // Oct 31 in LA

    const list = await api.call('GET', '/transactions?dateFrom=2026-11-01&dateTo=2026-11-01&pageSize=200', { token: user.token });
    const ids = new Set((list.body!.data as { fromAccount: { id: string } | null }[]).map((row) => row.fromAccount?.id));
    assert.equal(ids.has(vn.account), true);
    assert.equal(ids.has(la.account), false);
  });

  it('defaults the dashboard to the wallet zone\'s current month', async () => {
    const user = await registerProbeUser(api, 'tz-default');
    const expense = await categoryOf(api, user, user.walletId, 'EXPENSE');
    assert.ok(expense);
    const dashboard = await api.call('GET', `/dashboard?walletId=${user.walletId}`, { token: user.token });
    const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Ho_Chi_Minh', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
    assert.equal(dashboard.body!.data.period.dateFrom, `${today.slice(0, 7)}-01`);
    assert.equal(dashboard.body!.data.period.timeZone, 'Asia/Ho_Chi_Minh');
  });
});
