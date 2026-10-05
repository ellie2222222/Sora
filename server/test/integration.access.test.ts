import { strict as assert } from 'node:assert';
import { randomUUID } from 'node:crypto';
import { after, before, describe, it } from 'node:test';

import {
  addMember,
  categoryOf,
  createAccount,
  integrationSkipReason,
  nowIso,
  registerProbeUser,
  startTestApi,
  type ProbeUser,
  type TestApi,
} from './support/integration.ts';

/** AC-01, AC-02 and AC-04 over HTTP: no membership is 404, a role too low is 403, both server-side. */
describe('access control against a real database', { skip: integrationSkipReason() }, () => {
  let api: TestApi;
  let owner: ProbeUser;
  let editor: ProbeUser;
  let viewer: ProbeUser;
  let stranger: ProbeUser;
  const ids = { wallet: '', account: '', transaction: '', budget: '', goal: '', category: '' };

  before(async () => {
    api = await startTestApi();
    owner = await registerProbeUser(api, 'access-owner');
    editor = await registerProbeUser(api, 'access-editor');
    viewer = await registerProbeUser(api, 'access-viewer');
    stranger = await registerProbeUser(api, 'access-stranger');
    ids.wallet = owner.walletId;
    await addMember(api, owner, ids.wallet, editor, 'EDITOR');
    await addMember(api, owner, ids.wallet, viewer, 'VIEWER');

    ids.account = await createAccount(api, owner, ids.wallet, { initialBalance: '1000' });
    ids.category = await categoryOf(api, owner, ids.wallet, 'EXPENSE');
    const transaction = await api.call('POST', '/transactions', {
      token: owner.token,
      body: { type: 'EXPENSE', fromAccountId: ids.account, categoryId: ids.category, amount: '10', currency: 'VND', transactionDate: nowIso() },
    });
    ids.transaction = transaction.body!.data.id;
    const budget = await api.call('POST', '/budgets', {
      token: owner.token,
      body: { walletId: ids.wallet, categoryId: ids.category, name: `probe-${randomUUID()}`, amount: '100', currency: 'VND', periodType: 'CUSTOM', startDate: '2026-01-01', endDate: '2026-01-31' },
    });
    ids.budget = budget.body!.data.id;
    const goal = await api.call('POST', '/goals', {
      token: owner.token,
      body: { walletId: ids.wallet, name: `probe-${randomUUID()}`, targetAmount: '500', currency: 'VND' },
    });
    ids.goal = goal.body!.data.id;
  });

  after(async () => {
    await api?.close();
  });

  it('answers a non-member with 404 and the resource\'s own not-found code on every wallet-scoped read', async () => {
    const reads: [string, string][] = [
      [`/wallets/${ids.wallet}`, 'WALLET_NOT_FOUND'],
      [`/accounts/${ids.account}`, 'ACCOUNT_NOT_FOUND'],
      [`/transactions/${ids.transaction}`, 'TRANSACTION_NOT_FOUND'],
      [`/budgets/${ids.budget}`, 'BUDGET_NOT_FOUND'],
      [`/goals/${ids.goal}`, 'GOAL_NOT_FOUND'],
      [`/wallets/${ids.wallet}/members`, 'WALLET_NOT_FOUND'],
      [`/dashboard?walletId=${ids.wallet}`, 'WALLET_NOT_FOUND'],
      [`/wallets/${ids.wallet}/audit-logs`, 'WALLET_NOT_FOUND'],
    ];
    for (const [path, code] of reads) {
      const response = await api.call('GET', path, { token: stranger.token });
      assert.deepEqual([response.status, response.body?.error?.code], [404, code], `GET ${path}`);
    }
    // Categories have no detail read; their write path is where a stranger could probe one.
    const category = await api.call('PATCH', `/categories/${ids.category}`, { token: stranger.token, body: { name: 'probe-stranger' } });
    assert.deepEqual([category.status, category.body?.error?.code], [404, 'CATEGORY_NOT_FOUND']);
  });

  it('answers a real id the stranger cannot see exactly like an id that does not exist', async () => {
    const real = await api.call('GET', `/accounts/${ids.account}`, { token: stranger.token });
    const made_up = await api.call('GET', `/accounts/${randomUUID()}`, { token: stranger.token });
    assert.deepEqual([real.status, real.body?.error?.code], [made_up.status, made_up.body?.error?.code]);
  });

  it('answers a malformed path id with 404 ROUTE_NOT_FOUND, not a 500 from the uuid cast', async () => {
    for (const path of ['/wallets/not-a-uuid', '/accounts/not-a-uuid', `/wallets/${ids.wallet}/members/not-a-uuid`]) {
      const response = await api.call('GET', path, { token: stranger.token });
      assert.deepEqual([response.status, response.body?.error?.code], [404, 'ROUTE_NOT_FOUND'], `GET ${path}`);
    }
  });

  it('refuses a non-member\'s write with 404, and leaves no row behind', async () => {
    const before = await api.sql('SELECT count(*)::int AS n FROM transactions WHERE from_account_id = $1', [ids.account]);
    const write = await api.call('POST', '/transactions', {
      token: stranger.token,
      body: { type: 'EXPENSE', fromAccountId: ids.account, categoryId: ids.category, amount: '1', currency: 'VND', transactionDate: nowIso() },
    });
    assert.equal(write.status, 404);
    const afterWrite = await api.sql('SELECT count(*)::int AS n FROM transactions WHERE from_account_id = $1', [ids.account]);
    assert.deepEqual(afterWrite, before);
  });

  it('lets a VIEWER read everything but write nothing (403, not 404: membership is established)', async () => {
    assert.equal((await api.call('GET', `/accounts/${ids.account}`, { token: viewer.token })).status, 200);
    assert.equal((await api.call('GET', `/transactions/${ids.transaction}`, { token: viewer.token })).status, 200);
    assert.equal((await api.call('GET', `/wallets/${ids.wallet}/members`, { token: viewer.token })).status, 200);

    const writes: [string, string, unknown][] = [
      ['POST', '/transactions', { type: 'EXPENSE', fromAccountId: ids.account, categoryId: ids.category, amount: '1', currency: 'VND', transactionDate: nowIso() }],
      ['PATCH', `/transactions/${ids.transaction}`, { description: 'probe viewer edit' }],
      ['POST', `/transactions/${ids.transaction}/delete`, {}],
      ['POST', '/accounts', { walletId: ids.wallet, name: `probe-${randomUUID()}`, type: 'CASH', currency: 'VND' }],
      ['PATCH', `/budgets/${ids.budget}`, { name: 'probe viewer edit' }],
      ['POST', `/goals/${ids.goal}/contributions`, { accountId: ids.account, amount: '1', currency: 'VND', contributionDate: nowIso() }],
    ];
    for (const [method, path, body] of writes) {
      const response = await api.call(method, path, { token: viewer.token, body });
      assert.deepEqual([response.status, response.body?.error?.code], [403, 'FORBIDDEN'], `${method} ${path}`);
    }
  });

  it('lets an EDITOR write entries but not manage members, and keeps the audit log OWNER-only (AC-04)', async () => {
    const created = await api.call('POST', '/transactions', {
      token: editor.token,
      body: { type: 'EXPENSE', fromAccountId: ids.account, categoryId: ids.category, amount: '2', currency: 'VND', transactionDate: nowIso() },
    });
    assert.equal(created.status, 201);

    for (const user of [editor, viewer]) {
      const audit = await api.call('GET', `/wallets/${ids.wallet}/audit-logs`, { token: user.token });
      assert.equal(audit.status, 403);
      const invite = await api.call('POST', `/wallets/${ids.wallet}/invitations`, {
        token: user.token,
        body: { email: `probe+x-${randomUUID()}@example.invalid`, role: 'VIEWER' },
      });
      assert.equal(invite.status, 403);
    }
    assert.equal((await api.call('GET', `/wallets/${ids.wallet}/audit-logs`, { token: owner.token })).status, 200);
  });

  it('treats a removed member as a stranger from then on', async () => {
    const extra = await registerProbeUser(api, 'access-removed');
    await addMember(api, owner, ids.wallet, extra, 'EDITOR');
    const members = await api.call('GET', `/wallets/${ids.wallet}/members`, { token: owner.token });
    const membership = members.body!.data.find((member: { userId: string }) => member.userId === extra.id);
    const removed = await api.call('DELETE', `/wallets/${ids.wallet}/members/${membership.id}`, { token: owner.token });
    assert.equal(removed.status, 204, 'remove answers 204 No Content (API spec)');

    const read = await api.call('GET', `/accounts/${ids.account}`, { token: extra.token });
    assert.equal(read.status, 404);
    const [row] = await api.sql<{ status: string }>('SELECT status FROM wallet_members WHERE id = $1', [membership.id]);
    assert.equal(row?.status, 'REVOKED', 'the row stays so the creator name still resolves (BR-01)');
  });

  it('§2.5 role matrix: every wallet-scoped route answers a stranger 404 and each role below its minimum 403', async () => {
    const memberIdOf = async (user: ProbeUser) =>
      ((await api.call('GET', `/wallets/${ids.wallet}/members`, { token: owner.token })).body!.data as { id: string; userId: string }[]).find(
        (member) => member.userId === user.id,
      )!.id;
    const invitation = await api.call('POST', `/wallets/${ids.wallet}/invitations`, {
      token: owner.token,
      body: { email: `probe+matrix-${randomUUID()}@example.invalid`, role: 'VIEWER' },
    });
    const contribution = await api.call('POST', `/goals/${ids.goal}/contributions`, {
      token: owner.token,
      body: { accountId: ids.account, amount: '1', currency: 'VND', contributionDate: nowIso() },
    });
    assert.deepEqual([invitation.status, contribution.status], [201, 201]);
    const [editorMember, viewerMember] = [await memberIdOf(editor), await memberIdOf(viewer)];

    type Route = [method: string, path: string, body: unknown, minimum: 'VIEWER' | 'EDITOR' | 'OWNER'];
    const routes: Route[] = [
      ['GET', `/accounts?walletId=${ids.wallet}`, undefined, 'VIEWER'],
      ['GET', `/categories?walletId=${ids.wallet}`, undefined, 'VIEWER'],
      ['GET', `/transactions?walletId=${ids.wallet}`, undefined, 'VIEWER'],
      ['GET', `/budgets?walletId=${ids.wallet}`, undefined, 'VIEWER'],
      ['GET', `/goals?walletId=${ids.wallet}`, undefined, 'VIEWER'],
      ['GET', `/goals/${ids.goal}/contributions`, undefined, 'VIEWER'],
      ['POST', '/accounts', { walletId: ids.wallet, name: 'probe-matrix', type: 'CASH', currency: 'VND' }, 'EDITOR'],
      ['PATCH', `/accounts/${ids.account}`, { name: 'probe-matrix' }, 'EDITOR'],
      ['DELETE', `/accounts/${ids.account}`, undefined, 'EDITOR'],
      ['POST', '/categories', { walletId: ids.wallet, name: `probe-${randomUUID()}`, type: 'EXPENSE' }, 'EDITOR'],
      ['PATCH', `/categories/${ids.category}`, { name: 'probe-matrix' }, 'EDITOR'],
      ['DELETE', `/categories/${ids.category}`, undefined, 'EDITOR'],
      ['POST', '/transactions', { type: 'EXPENSE', fromAccountId: ids.account, categoryId: ids.category, amount: '1', currency: 'VND', transactionDate: nowIso() }, 'EDITOR'],
      ['PATCH', `/transactions/${ids.transaction}`, { description: 'probe-matrix' }, 'EDITOR'],
      ['POST', `/transactions/${ids.transaction}/delete`, {}, 'EDITOR'],
      [
        'POST',
        '/budgets',
        { walletId: ids.wallet, categoryId: ids.category, name: 'probe-matrix', amount: '1', currency: 'VND', periodType: 'CUSTOM', startDate: '2026-02-01', endDate: '2026-02-28' },
        'EDITOR',
      ],
      ['PATCH', `/budgets/${ids.budget}`, { name: 'probe-matrix' }, 'EDITOR'],
      ['DELETE', `/budgets/${ids.budget}`, undefined, 'EDITOR'],
      ['POST', '/goals', { walletId: ids.wallet, name: 'probe-matrix', targetAmount: '1', currency: 'VND' }, 'EDITOR'],
      ['PATCH', `/goals/${ids.goal}`, { name: 'probe-matrix' }, 'EDITOR'],
      ['DELETE', `/goals/${ids.goal}`, undefined, 'EDITOR'],
      ['POST', `/goals/${ids.goal}/contributions`, { accountId: ids.account, amount: '1', currency: 'VND', contributionDate: nowIso() }, 'EDITOR'],
      ['DELETE', `/goals/${ids.goal}/contributions/${contribution.body!.data.id}`, undefined, 'EDITOR'],
      ['PATCH', `/wallets/${ids.wallet}`, { name: 'probe-matrix' }, 'OWNER'],
      ['DELETE', `/wallets/${ids.wallet}`, undefined, 'OWNER'],
      ['PATCH', `/wallets/${ids.wallet}/members/${viewerMember}`, { role: 'EDITOR' }, 'OWNER'],
      ['DELETE', `/wallets/${ids.wallet}/members/${viewerMember}`, undefined, 'OWNER'],
      ['POST', `/wallets/${ids.wallet}/transfer-ownership`, { toUserId: editor.id }, 'OWNER'],
      ['GET', `/wallets/${ids.wallet}/invitations`, undefined, 'OWNER'],
      ['POST', `/wallets/${ids.wallet}/invitations`, { email: `probe+matrix-${randomUUID()}@example.invalid`, role: 'VIEWER' }, 'OWNER'],
      ['DELETE', `/wallets/${ids.wallet}/invitations/${invitation.body!.data.id}`, undefined, 'OWNER'],
      ['GET', `/wallets/${ids.wallet}/audit-logs`, undefined, 'OWNER'],
    ];
    const below = { VIEWER: [], EDITOR: [viewer], OWNER: [editor, viewer] } satisfies Record<Route[3], ProbeUser[]>;

    for (const [method, path, body, minimum] of routes) {
      const asStranger = await api.call(method, path, { token: stranger.token, body });
      assert.equal(asStranger.status, 404, `stranger ${method} ${path} → ${JSON.stringify(asStranger.body?.error)}`);
      for (const user of below[minimum]) {
        const refused = await api.call(method, path, { token: user.token, body });
        const role = user === editor ? 'EDITOR' : 'VIEWER';
        assert.deepEqual([refused.status, refused.body?.error?.code], [403, 'FORBIDDEN'], `${role} ${method} ${path}`);
      }
    }

    // Nothing a refused call touched changed: the shared fixture is intact.
    const [wallet] = await api.sql<{ status: string; owner_user_id: string }>('SELECT status, owner_user_id FROM wallets WHERE id = $1', [ids.wallet]);
    assert.deepEqual(wallet, { status: 'ACTIVE', owner_user_id: owner.id });
    const roles = await api.sql<{ id: string; role: string; status: string }>('SELECT id, role, status FROM wallet_members WHERE id = ANY($1::uuid[]) ORDER BY role', [[editorMember, viewerMember]]);
    assert.deepEqual(roles.map((row) => [row.role, row.status]), [['EDITOR', 'ACTIVE'], ['VIEWER', 'ACTIVE']]);
    const [txn] = await api.sql<{ status: string; description: string | null }>('SELECT status, description FROM transactions WHERE id = $1', [ids.transaction]);
    assert.equal(txn?.status, 'COMPLETED');
    assert.notEqual(txn?.description, 'probe-matrix');
  });

  it('does not reveal another wallet\'s category through a cross-wallet reference', async () => {
    const strangerAccount = await createAccount(api, stranger, stranger.walletId);
    const response = await api.call('POST', '/transactions', {
      token: stranger.token,
      body: { type: 'EXPENSE', fromAccountId: strangerAccount, categoryId: ids.category, amount: '1', currency: 'VND', transactionDate: nowIso() },
    });
    const madeUp = await api.call('POST', '/transactions', {
      token: stranger.token,
      body: { type: 'EXPENSE', fromAccountId: strangerAccount, categoryId: randomUUID(), amount: '1', currency: 'VND', transactionDate: nowIso() },
    });
    assert.deepEqual(
      [response.status, response.body?.error?.code],
      [madeUp.status, madeUp.body?.error?.code],
      'a category id from a wallet the caller cannot see must look the same as one that does not exist (AC-01)',
    );
  });
});
