import { strict as assert } from 'node:assert';
import { randomUUID } from 'node:crypto';
import { after, before, describe, it } from 'node:test';

import { sql } from 'kysely';

import {
  addMember,
  categoryOf,
  createAccount,
  integrationSkipReason,
  openTransaction,
  registerProbeUser,
  startTestApi,
  stillWaiting,
  whileHeld,
  type TestApi,
} from './support/integration.ts';

const WHEN = '2026-06-10T09:00:00.000Z';

/**
 * Read-then-write races, each staged by holding one side's database transaction open while the
 * other side's request arrives over HTTP. Every case asserts the late request waited on the lock,
 * then answered from the committed state rather than from what it read before.
 */
describe('concurrent writes against a real database', { skip: integrationSkipReason() }, () => {
  let api: TestApi;

  before(async () => {
    api = await startTestApi();
  });

  after(async () => {
    await api?.close();
  });

  const ownersOf = async (walletId: string) =>
    (await api.sql<{ count: string }>("SELECT count(*)::text AS count FROM wallet_members WHERE wallet_id = $1 AND role = 'OWNER' AND status = 'ACTIVE'", [walletId]))[0]!.count;
  const newCategory = (token: string, walletId: string, extra: Record<string, unknown> = {}) =>
    api.call('POST', '/categories', { token, body: { walletId, name: `probe-${randomUUID()}`, type: 'EXPENSE', ...extra } });
  const newGoal = (token: string, walletId: string) =>
    api.call('POST', '/goals', { token, body: { walletId, name: `probe-${randomUUID()}`, targetAmount: '100', currency: 'VND' } });
  const juneBudget = (token: string, walletId: string, categoryId: string) =>
    api.call('POST', '/budgets', {
      token,
      body: { walletId, categoryId, name: `probe-${randomUUID()}`, amount: '100', currency: 'VND', periodType: 'CUSTOM', startDate: '2026-06-01', endDate: '2026-06-30' },
    });

  it('BR-01: a role change racing an ownership transfer never leaves the wallet without an owner', async () => {
    const owner = await registerProbeUser(api, 'race-owner');
    const editor = await registerProbeUser(api, 'race-editor');
    await addMember(api, owner, owner.walletId, editor, 'EDITOR');
    const [editorRow] = await api.sql<{ id: string }>('SELECT id FROM wallet_members WHERE wallet_id = $1 AND user_id = $2', [owner.walletId, editor.id]);

    // The transfer to the editor, mid-flight: demoted and promoted, not yet committed.
    const { waited, result } = await whileHeld(
      api,
      async (trx) => {
        await sql`SELECT id FROM wallet_members WHERE wallet_id = ${owner.walletId} AND status = 'ACTIVE' ORDER BY id FOR UPDATE`.execute(trx);
        await sql`UPDATE wallet_members SET role = 'EDITOR' WHERE wallet_id = ${owner.walletId} AND user_id = ${owner.id}`.execute(trx);
        await sql`UPDATE wallet_members SET role = 'OWNER' WHERE id = ${editorRow!.id}`.execute(trx);
        await sql`UPDATE wallets SET owner_user_id = ${editor.id} WHERE id = ${owner.walletId}`.execute(trx);
      },
      () => api.call('PATCH', `/wallets/${owner.walletId}/members/${editorRow!.id}`, { token: owner.token, body: { role: 'VIEWER' } }),
    );

    assert.equal(waited, true, 'the role change must wait on the membership rows');
    assert.deepEqual([result.status, result.body?.error?.code], [403, 'FORBIDDEN'], 'the caller is no longer the owner');
    assert.equal(await ownersOf(owner.walletId), '1');
  });

  it('BR-01: a member leaving while a transfer makes them the owner is refused', async () => {
    const owner = await registerProbeUser(api, 'race-leave-owner');
    const editor = await registerProbeUser(api, 'race-leave-editor');
    await addMember(api, owner, owner.walletId, editor, 'EDITOR');

    const { waited, result } = await whileHeld(
      api,
      async (trx) => {
        await sql`SELECT id FROM wallet_members WHERE wallet_id = ${owner.walletId} AND status = 'ACTIVE' ORDER BY id FOR UPDATE`.execute(trx);
        await sql`UPDATE wallet_members SET role = 'EDITOR' WHERE wallet_id = ${owner.walletId} AND user_id = ${owner.id}`.execute(trx);
        await sql`UPDATE wallet_members SET role = 'OWNER' WHERE wallet_id = ${owner.walletId} AND user_id = ${editor.id}`.execute(trx);
      },
      () => api.call('POST', `/wallets/${owner.walletId}/leave`, { token: editor.token }),
    );

    assert.equal(waited, true, 'leaving must wait on the membership rows');
    assert.deepEqual([result.status, result.body?.error?.code], [409, 'WALLET_LAST_OWNER']);
    assert.equal(await ownersOf(owner.walletId), '1');
  });

  it('BR-08: an accept racing a revoke cannot join the wallet through the revoked invitation', async () => {
    const owner = await registerProbeUser(api, 'race-inviter');
    const invitee = await registerProbeUser(api, 'race-invitee');
    const invite = await api.call('POST', `/wallets/${owner.walletId}/invitations`, { token: owner.token, body: { email: invitee.email, role: 'EDITOR' } });
    assert.equal(invite.status, 201);

    const { waited, result } = await whileHeld(
      api,
      async (trx) => {
        await sql`UPDATE wallet_invitations SET revoked_at = now() WHERE id = ${invite.body!.data.id}`.execute(trx);
      },
      () => api.call('POST', '/invitations/accept', { token: invitee.token, body: { token: invite.body!.data.token } }),
    );

    assert.equal(waited, true, 'the accept must wait on the invitation row');
    assert.deepEqual([result.status, result.body?.error?.code], [404, 'INVITATION_NOT_FOUND']);
    assert.deepEqual(await api.sql('SELECT id FROM wallet_members WHERE wallet_id = $1 AND user_id = $2', [owner.walletId, invitee.id]), []);
    const [row] = await api.sql<{ accepted_at: Date | null }>('SELECT accepted_at FROM wallet_invitations WHERE id = $1', [invite.body!.data.id]);
    assert.equal(row?.accepted_at, null, 'never both revoked and accepted');
  });

  it('two archives of a wallet\'s last two accounts leave one of them active', async () => {
    const user = await registerProbeUser(api, 'race-archive');
    const [seeded] = await api.sql<{ id: string }>("SELECT id FROM accounts WHERE wallet_id = $1 AND status = 'ACTIVE'", [user.walletId]);
    const other = await createAccount(api, user, user.walletId);

    const { waited, result } = await whileHeld(
      api,
      async (trx) => {
        await sql`SELECT id FROM accounts WHERE wallet_id = ${user.walletId} AND status = 'ACTIVE' ORDER BY id FOR UPDATE`.execute(trx);
        await sql`UPDATE accounts SET status = 'ARCHIVED' WHERE id = ${seeded!.id}`.execute(trx);
      },
      () => api.call('DELETE', `/accounts/${other}`, { token: user.token }),
    );

    assert.equal(waited, true, 'the archive must wait on the wallet\'s active accounts');
    assert.deepEqual([result.status, result.body?.error?.code], [409, 'ACCOUNT_LAST_ACTIVE']);
    assert.deepEqual(await api.sql("SELECT id FROM accounts WHERE wallet_id = $1 AND status = 'ACTIVE'", [user.walletId]), [{ id: other }]);
  });

  it('a transaction waiting on an account that is archived meanwhile is refused', async () => {
    const user = await registerProbeUser(api, 'race-archived-account');
    const account = await createAccount(api, user, user.walletId, { initialBalance: '100' });
    const food = await categoryOf(api, user, user.walletId, 'EXPENSE');

    const { waited, result } = await whileHeld(
      api,
      async (trx) => {
        await sql`UPDATE accounts SET status = 'ARCHIVED' WHERE id = ${account}`.execute(trx);
      },
      () =>
        api.call('POST', '/transactions', {
          token: user.token,
          body: { type: 'EXPENSE', fromAccountId: account, categoryId: food, amount: '1', currency: 'VND', transactionDate: WHEN },
        }),
    );

    assert.equal(waited, true, 'the create must wait on the account row');
    assert.deepEqual([result.status, result.body?.error?.code], [409, 'ACCOUNT_ARCHIVED']);
    assert.deepEqual(await api.sql('SELECT id FROM transactions WHERE from_account_id = $1', [account]), []);
  });

  it('a contribution waiting on a goal that is cancelled meanwhile is refused', async () => {
    const user = await registerProbeUser(api, 'race-goal');
    const account = await createAccount(api, user, user.walletId);
    const goalId = (await newGoal(user.token, user.walletId)).body!.data.id as string;

    const { waited, result } = await whileHeld(
      api,
      async (trx) => {
        await sql`UPDATE goals SET status = 'CANCELLED' WHERE id = ${goalId}`.execute(trx);
      },
      () =>
        api.call('POST', `/goals/${goalId}/contributions`, {
          token: user.token,
          body: { accountId: account, amount: '5', currency: 'VND', contributionDate: WHEN },
        }),
    );

    assert.equal(waited, true, 'the contribution must wait on the goal row');
    assert.deepEqual([result.status, result.body?.error?.code], [409, 'GOAL_NOT_ACTIVE']);
    assert.deepEqual(await api.sql('SELECT id FROM goal_contributions WHERE goal_id = $1', [goalId]), []);
  });

  it('a budget waiting on a category that is archived meanwhile is refused', async () => {
    const user = await registerProbeUser(api, 'race-category');
    const categoryId = (await newCategory(user.token, user.walletId)).body!.data.id as string;

    const { waited, result } = await whileHeld(
      api,
      async (trx) => {
        await sql`SELECT id FROM categories WHERE wallet_id = ${user.walletId} ORDER BY id FOR UPDATE`.execute(trx);
        await sql`UPDATE categories SET status = 'ARCHIVED' WHERE id = ${categoryId}`.execute(trx);
      },
      () => juneBudget(user.token, user.walletId, categoryId),
    );

    assert.equal(waited, true, 'the budget must wait on the category row');
    assert.deepEqual([result.status, result.body?.error?.code], [409, 'CATEGORY_ARCHIVED']);
    assert.deepEqual(await api.sql('SELECT id FROM budgets WHERE category_id = $1', [categoryId]), []);
  });

  it('a category cannot be created under a parent archived meanwhile', async () => {
    const user = await registerProbeUser(api, 'race-parent');
    const parentId = (await newCategory(user.token, user.walletId)).body!.data.id as string;

    const { waited, result } = await whileHeld(
      api,
      async (trx) => {
        await sql`SELECT id FROM categories WHERE wallet_id = ${user.walletId} ORDER BY id FOR UPDATE`.execute(trx);
        await sql`UPDATE categories SET status = 'ARCHIVED' WHERE id = ${parentId}`.execute(trx);
      },
      () => newCategory(user.token, user.walletId, { parentId }),
    );

    assert.equal(waited, true, 'the create must wait on the parent row');
    assert.deepEqual([result.status, result.body?.error?.code], [409, 'CATEGORY_PARENT_ARCHIVED']);
  });

  it('§6.5: an account, category, goal or budget create waiting on a wallet archived meanwhile is refused', async () => {
    const creates: Record<string, (token: string, walletId: string, categoryId: string) => ReturnType<typeof api.call>> = {
      accounts: (token, walletId) =>
        api.call('POST', '/accounts', { token, body: { walletId, name: `probe-${randomUUID()}`, type: 'CASH', currency: 'VND', initialBalance: '0' } }),
      categories: (token, walletId) => newCategory(token, walletId),
      goals: (token, walletId) => newGoal(token, walletId),
      budgets: juneBudget,
    };

    for (const [table, create] of Object.entries(creates)) {
      const user = await registerProbeUser(api, `race-wallet-${table}`);
      const categoryId = (await newCategory(user.token, user.walletId)).body!.data.id as string;
      const [before] = await api.sql<{ count: string }>(`SELECT count(*)::text AS count FROM ${table} WHERE wallet_id = $1`, [user.walletId]);

      const { waited, result } = await whileHeld(
        api,
        async (trx) => {
          await sql`UPDATE wallets SET status = 'ARCHIVED' WHERE id = ${user.walletId}`.execute(trx);
        },
        () => create(user.token, user.walletId, categoryId),
      );

      assert.equal(waited, true, `the ${table} create must wait on the wallet row`);
      assert.deepEqual([result.status, result.body?.error?.code], [409, 'WALLET_ARCHIVED'], table);
      const [after] = await api.sql<{ count: string }>(`SELECT count(*)::text AS count FROM ${table} WHERE wallet_id = $1`, [user.walletId]);
      assert.equal(after!.count, before!.count, `no ${table} row written`);
    }
  });

  it('a delete racing a delete of the same transaction applies, and audits, exactly once', async () => {
    const user = await registerProbeUser(api, 'race-delete');
    const account = await createAccount(api, user, user.walletId, { initialBalance: '100' });
    const food = await categoryOf(api, user, user.walletId, 'EXPENSE');
    const created = await api.call('POST', '/transactions', {
      token: user.token,
      body: { type: 'EXPENSE', fromAccountId: account, categoryId: food, amount: '1', currency: 'VND', transactionDate: WHEN },
    });
    const id = created.body!.data.id as string;

    const { waited, result } = await whileHeld(
      api,
      async (trx) => {
        await sql`UPDATE transactions SET status = 'DELETED' WHERE id = ${id}`.execute(trx);
      },
      () => api.call('POST', `/transactions/${id}/delete`, { token: user.token, body: {} }),
    );

    assert.equal(waited, true, 'the delete must wait on the transaction row');
    assert.deepEqual([result.status, result.body?.error?.code], [409, 'TRANSACTION_ALREADY_DELETED']);
    assert.deepEqual(await api.sql("SELECT id FROM audit_logs WHERE entity_id = $1 AND event = 'TRANSACTION_DELETED'", [id]), []);
  });

  it('removing a contribution while its backing transaction is being deleted waits instead of deadlocking', async () => {
    const user = await registerProbeUser(api, 'race-contribution');
    const account = await createAccount(api, user, user.walletId, { initialBalance: '100' });
    const food = await categoryOf(api, user, user.walletId, 'EXPENSE');
    const goalId = (await newGoal(user.token, user.walletId)).body!.data.id as string;
    const contribution = await api.call('POST', `/goals/${goalId}/contributions`, {
      token: user.token,
      body: { accountId: account, amount: '5', currency: 'VND', contributionDate: WHEN, recordAsTransaction: true, categoryId: food },
    });
    assert.equal(contribution.status, 201, JSON.stringify(contribution.body));
    const [backing] = await api.sql<{ transaction_id: string }>('SELECT transaction_id FROM goal_contributions WHERE id = $1', [contribution.body!.data.id]);

    // The transaction delete's order: the transaction row now, its contribution row once the
    // removal is already waiting. Taken in the opposite order, the two would deadlock.
    let takeContribution!: () => void;
    const contributionTurn = new Promise<void>((resolve) => (takeContribution = resolve));
    let contributionTaken!: Promise<unknown>;
    const commit = await openTransaction(api, async (trx) => {
      await sql`UPDATE transactions SET status = 'DELETED' WHERE id = ${backing!.transaction_id}`.execute(trx);
      contributionTaken = contributionTurn.then(() =>
        sql`DELETE FROM goal_contributions WHERE transaction_id = ${backing!.transaction_id}`.execute(trx),
      );
    });

    let removal: ReturnType<typeof api.call> | undefined;
    let waited = false;
    try {
      removal = api.call('DELETE', `/goals/${goalId}/contributions/${contribution.body!.data.id}`, { token: user.token });
      waited = await stillWaiting(removal);
      takeContribution();
      await contributionTaken;
    } finally {
      takeContribution();
      await commit();
    }

    assert.equal(waited, true, 'the removal must wait on the transaction row, holding nothing the delete needs');
    const answered = await removal!;
    assert.deepEqual([answered.status, answered.body?.error?.code], [404, 'CONTRIBUTION_NOT_FOUND'], 'the delete already took it');
  });

  it('§10.4: a permanent delete of a category an archived budget still names is a 409, not a 500', async () => {
    const user = await registerProbeUser(api, 'race-delete-category');
    const categoryId = (await newCategory(user.token, user.walletId)).body!.data.id as string;
    const budget = await juneBudget(user.token, user.walletId, categoryId);
    assert.equal((await api.call('DELETE', `/budgets/${budget.body!.data.id}`, { token: user.token })).status, 204);

    const refused = await api.call('DELETE', `/categories/${categoryId}?mode=permanent`, { token: user.token });
    assert.deepEqual([refused.status, refused.body?.error?.code], [409, 'CATEGORY_IN_USE']);
  });
});
