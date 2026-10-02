import { strict as assert } from 'node:assert';
import { randomUUID } from 'node:crypto';
import { after, before, describe, it } from 'node:test';

import { parseMoney } from '@sora/contracts';

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
const PERIOD = { dateFrom: '2026-12-01', dateTo: '2026-12-31' };
const IN_PERIOD = '2026-12-10T09:00:00.000Z';

type Totals = { currency: string; amount: string }[];
const allZero = (totals: Totals) => totals.every((total) => parseMoney(total.amount) === 0n);

/** §14.1 GET /dashboard and §6.1 GET /wallets, read back over HTTP against a real database. */
describe('the dashboard against a real database', { skip: integrationSkipReason() }, () => {
  let api: TestApi;

  const post = (user: ProbeUser, body: Record<string, unknown>) =>
    api.call('POST', '/transactions', { token: user.token, body: { currency: 'VND', transactionDate: IN_PERIOD, ...body } });
  const dashboard = (user: ProbeUser, query: string) => api.call('GET', `/dashboard?${query}`, { token: user.token });
  const periodQuery = (user: ProbeUser) => `walletId=${user.walletId}&dateFrom=${PERIOD.dateFrom}&dateTo=${PERIOD.dateTo}`;

  async function expenseCategories(user: ProbeUser, count: number): Promise<string[]> {
    const listed = await api.call('GET', `/categories?walletId=${user.walletId}&type=EXPENSE&pageSize=200`, { token: user.token });
    const ids = (listed.body!.data as { id: string; type: string }[]).filter((c) => c.type === 'EXPENSE').map((c) => c.id);
    assert.ok(ids.length >= count, `needs ${count} starter expense categories`);
    return ids.slice(0, count);
  }

  before(async () => {
    api = await startTestApi();
  });

  after(async () => {
    await api?.close();
  });

  it('DASH-US-01: ranks spending by category descending with shares, in the dominant expense currency only', async () => {
    const user = await registerProbeUser(api, 'dash-slices');
    const main = await createAccount(api, user, user.walletId, { initialBalance: '10000000' });
    const other = await createAccount(api, user, user.walletId);
    const usd = await createAccount(api, user, user.walletId, { currency: 'USD', initialBalance: '100' });
    const [small, large, medium] = await expenseCategories(user, 3);

    await post(user, { type: 'EXPENSE', fromAccountId: main, categoryId: small, amount: '200000' });
    await post(user, { type: 'EXPENSE', fromAccountId: main, categoryId: large, amount: '500000' });
    await post(user, { type: 'EXPENSE', fromAccountId: main, categoryId: medium, amount: '300000' });
    await post(user, { type: 'TRANSFER', fromAccountId: main, toAccountId: other, amount: '4000000' });
    await post(user, { type: 'EXPENSE', fromAccountId: usd, categoryId: small, amount: '7', currency: 'USD' });

    const response = await dashboard(user, periodQuery(user));
    assert.equal(response.status, 200);
    assert.deepEqual(
      response.body!.data.spendingByCategory.map((slice: { categoryId: string; amount: string; percentage: number }) => [
        slice.categoryId,
        slice.amount,
        slice.percentage,
      ]),
      [
        [large, '500000.0000', 50],
        [medium, '300000.0000', 30],
        [small, '200000.0000', 20],
      ],
      'the USD expense and the transfer are in no VND slice',
    );
  });

  it('DASH-US-01: carries the latest ten transactions newest first, and active budgets and goals with derived figures', async () => {
    const user = await registerProbeUser(api, 'dash-payload');
    const main = await createAccount(api, user, user.walletId, { initialBalance: '10000000' });
    const food = await categoryOf(api, user, user.walletId, 'EXPENSE');

    const created: string[] = [];
    for (let day = 1; day <= 11; day += 1) {
      const sent = await post(user, {
        type: 'EXPENSE',
        fromAccountId: main,
        categoryId: food,
        amount: day === 11 ? '450000' : '5000',
        transactionDate: `2026-12-${String(day).padStart(2, '0')}T09:00:00.000Z`,
      });
      assert.equal(sent.status, 201);
      created.push(sent.body!.data.id);
    }

    const budget = await api.call('POST', '/budgets', {
      token: user.token,
      body: { walletId: user.walletId, categoryId: food, name: `probe-${randomUUID()}`, amount: '1000000', currency: 'VND', periodType: 'CUSTOM', startDate: PERIOD.dateFrom, endDate: PERIOD.dateTo },
    });
    assert.equal(budget.status, 201);
    const goal = await api.call('POST', '/goals', { token: user.token, body: { walletId: user.walletId, name: `probe-${randomUUID()}`, targetAmount: '1000', currency: 'VND' } });
    assert.equal(goal.status, 201);
    const contribution = await api.call('POST', `/goals/${goal.body!.data.id}/contributions`, {
      token: user.token,
      body: { accountId: main, amount: '250', currency: 'VND', contributionDate: IN_PERIOD },
    });
    assert.equal(contribution.status, 201);

    const response = await dashboard(user, periodQuery(user));
    assert.equal(response.status, 200);
    const dash = response.body!.data;
    assert.deepEqual(
      dash.recentTransactions.map((transaction: { id: string }) => transaction.id),
      created.slice(1).reverse(),
      'the ten latest, newest first; the oldest is cut',
    );

    assert.equal(dash.activeBudgets.length, 1);
    const [activeBudget] = dash.activeBudgets;
    assert.deepEqual(
      [activeBudget.id, activeBudget.spent, activeBudget.remaining, activeBudget.usagePercentage, activeBudget.isOverBudget],
      [budget.body!.data.id, '500000.0000', '500000.0000', 50, false],
    );

    assert.equal(dash.activeGoals.length, 1);
    const [activeGoal] = dash.activeGoals;
    assert.deepEqual(
      [activeGoal.id, activeGoal.currentAmount, activeGoal.remaining, activeGoal.progressPercentage, activeGoal.contributionCount],
      [goal.body!.data.id, '250.0000', '750.0000', 25, 1],
    );
  });

  it('DASH-US-01: defaults to the current calendar month when no period is given', async () => {
    const user = await registerProbeUser(api, 'dash-default');
    const main = await createAccount(api, user, user.walletId, { initialBalance: '1000000' });
    const food = await categoryOf(api, user, user.walletId, 'EXPENSE');
    const now = new Date();
    const monthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)).toISOString().slice(0, 10);
    const monthEnd = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 0)).toISOString().slice(0, 10);
    const lastMonth = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 1, 15, 9)).toISOString();

    await post(user, { type: 'EXPENSE', fromAccountId: main, categoryId: food, amount: '12000', transactionDate: now.toISOString() });
    await post(user, { type: 'EXPENSE', fromAccountId: main, categoryId: food, amount: '999', transactionDate: lastMonth });

    const response = await dashboard(user, `walletId=${user.walletId}`);
    assert.equal(response.status, 200);
    assert.deepEqual(response.body!.data.period, { dateFrom: monthStart, dateTo: monthEnd });
    assert.deepEqual(response.body!.data.expense, [{ currency: 'VND', amount: '12000.0000' }], "last month's expense is outside the default window");
  });

  it('DASH-US-01: reports a period with no activity, and a wallet with no transactions, as 200 with every figure present', async () => {
    const quiet = await registerProbeUser(api, 'dash-quiet');
    await createAccount(api, quiet, quiet.walletId, { initialBalance: '1000' });
    const empty = await registerProbeUser(api, 'dash-empty');

    for (const user of [quiet, empty]) {
      const response = await dashboard(user, periodQuery(user));
      assert.equal(response.status, 200);
      const dash = response.body!.data;
      assert.deepEqual(dash.period, PERIOD, 'the period is reported, not omitted');
      if (user === quiet) assert.deepEqual(dash.totalBalance, [{ currency: 'VND', amount: '1000.0000' }]);
      else assert.ok(allZero(dash.totalBalance), 'a wallet with no accounts holds nothing');
      for (const field of ['income', 'expense', 'net', 'transferredIn', 'transferredOut'] as const) {
        assert.ok(Array.isArray(dash[field]), `${field} is present`);
        assert.ok(allZero(dash[field]), `${field} carries no non-zero figure`);
      }
      assert.deepEqual(
        [dash.spendingByCategory, dash.spendingByMember, dash.recentTransactions, dash.activeBudgets, dash.activeGoals],
        [[], [], [], [], []],
      );
    }
  });

  it('DASH-US-01: answers a non-member 404 WALLET_NOT_FOUND and a missing bearer 401', async () => {
    const owner = await registerProbeUser(api, 'dash-access-owner');
    const stranger = await registerProbeUser(api, 'dash-access-stranger');

    const foreign = await dashboard(stranger, periodQuery(owner));
    assert.deepEqual([foreign.status, foreign.body?.error?.code], [404, 'WALLET_NOT_FOUND']);

    const anonymous = await api.call('GET', `/dashboard?${periodQuery(owner)}`);
    assert.deepEqual([anonymous.status, anonymous.body?.error?.code], [401, 'UNAUTHENTICATED']);
  });

  it('DASH-US-01: refuses an inverted date range with 422 VALIDATION_FAILED', async () => {
    const user = await registerProbeUser(api, 'dash-inverted');
    const inverted = await dashboard(user, `walletId=${user.walletId}&dateFrom=2026-12-31&dateTo=2026-12-01`);
    assert.deepEqual([inverted.status, inverted.body?.error?.code], [422, 'VALIDATION_FAILED']);
    const pastDefaultEnd = await dashboard(user, `walletId=${user.walletId}&dateFrom=2999-01-01`);
    assert.deepEqual([pastDefaultEnd.status, pastDefaultEnd.body?.error?.code], [422, 'VALIDATION_FAILED'], 'a lone bound against the default other end');
  });

  it('DASH-US-02: lists each reachable wallet with its own per-currency balances, role and label, never aggregated', async () => {
    const follower = await registerProbeUser(api, 'dash-compare');
    const mom = await registerProbeUser(api, 'dash-compare-mom');
    await createAccount(api, follower, follower.walletId, { initialBalance: '1000' });
    await createAccount(api, follower, follower.walletId, { currency: 'USD', initialBalance: '10' });
    await createAccount(api, mom, mom.walletId, { initialBalance: '500' });

    const invite = await api.call('POST', `/wallets/${mom.walletId}/invitations`, {
      token: mom.token,
      body: { email: follower.email, role: 'VIEWER', relationLabel: 'Mom' },
    });
    assert.equal(invite.status, 201);
    const accepted = await api.call('POST', '/invitations/accept', { token: follower.token, body: { token: invite.body!.data.token } });
    assert.ok(accepted.status < 300);

    const listed = await api.call('GET', '/wallets', { token: follower.token });
    assert.equal(listed.status, 200);
    const wallets = listed.body!.data as { id: string; role: string; relationLabel: string | null; isOwn: boolean; balances: Totals }[];
    assert.deepEqual(wallets.map((wallet) => wallet.id).sort(), [follower.walletId, mom.walletId].sort());

    const own = wallets.find((wallet) => wallet.id === follower.walletId)!;
    assert.deepEqual([own.role, own.isOwn], ['OWNER', true]);
    assert.deepEqual(own.balances, [
      { currency: 'USD', amount: '10.0000' },
      { currency: 'VND', amount: '1000.0000' },
    ]);

    const shared = wallets.find((wallet) => wallet.id === mom.walletId)!;
    assert.deepEqual([shared.role, shared.isOwn, shared.relationLabel], ['VIEWER', false, 'Mom']);
    assert.deepEqual(shared.balances, [{ currency: 'VND', amount: '500.0000' }], "the follower's own VND is not folded in");
  });

  it('DASH-US-03: omits the valuation entirely, and looks up no rate, when no displayCurrency is asked for', async () => {
    const user = await registerProbeUser(api, 'dash-no-valuation');
    await createAccount(api, user, user.walletId, { initialBalance: '1000' });
    await createAccount(api, user, user.walletId, { currency: 'USD', initialBalance: '10' });

    const original = globalThis.fetch;
    let fetches = 0;
    globalThis.fetch = (async (...args: Parameters<typeof fetch>) => {
      fetches += 1;
      return original(...args);
    }) as typeof fetch;
    try {
      const response = await dashboard(user, periodQuery(user));
      assert.equal(response.status, 200);
      assert.equal('valuation' in response.body!.data, false, 'omitted, not sent as null');
      assert.equal(fetches, 0);
    } finally {
      globalThis.fetch = original;
    }

    const asked = await dashboard(user, `${periodQuery(user)}&displayCurrency=EUR`);
    assert.equal('valuation' in asked.body!.data, true, 'present once a display currency is asked for');
  });

  it('DASH-US-01: reading the dashboard writes no audit row', async () => {
    const owner = await registerProbeUser(api, 'dash-audit');
    const viewer = await registerProbeUser(api, 'dash-audit-viewer');
    const main = await createAccount(api, owner, owner.walletId, { initialBalance: '1000' });
    await addMember(api, owner, owner.walletId, viewer, 'VIEWER');
    const auditRows = async () =>
      (
        await api.sql<{ count: string }>('SELECT count(*)::text AS count FROM audit_logs WHERE wallet_id = $1 OR actor_id = ANY($2::uuid[])', [
          owner.walletId,
          [owner.id, viewer.id],
        ])
      )[0]!.count;

    const before = await auditRows();
    for (const [user, query] of [
      [owner, periodQuery(owner)],
      [owner, `${periodQuery(owner)}&accountId=${main}`],
      [viewer, periodQuery(owner)],
    ] as const) {
      assert.equal((await dashboard(user, query)).status, 200);
    }
    assert.equal(await auditRows(), before);
  });
});
