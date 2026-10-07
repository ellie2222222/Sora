import { strict as assert } from 'node:assert';
import { randomUUID } from 'node:crypto';
import { after, before, describe, it } from 'node:test';

import { addMember, createAccount, integrationSkipReason, registerProbeUser, startTestApi, type ProbeUser, type TestApi } from './support/integration.ts';

/**
 * API-05 on the list endpoints that page alongside their filters: every page carries the same total,
 * the last one says there is no more, and walking the pages yields every row exactly once.
 */
describe('list pagination against a real database', { skip: integrationSkipReason() }, () => {
  let api: TestApi;

  before(async () => {
    api = await startTestApi();
  });

  after(async () => {
    await api?.close();
  });

  async function walk(user: ProbeUser, path: string, pageSize = 2): Promise<string[]> {
    const ids: string[] = [];
    const separator = path.includes('?') ? '&' : '?';
    for (let page = 1; ; page += 1) {
      const response = await api.call('GET', `${path}${separator}page=${page}&pageSize=${pageSize}`, { token: user.token });
      assert.equal(response.status, 200, `${path} page ${page}`);
      const meta = response.body!.meta.pagination;
      ids.push(...(response.body!.data as { id: string }[]).map((row) => row.id));
      assert.deepEqual([meta.page, meta.pageSize, meta.hasMore], [page, pageSize, page * pageSize < meta.total], `${path} page ${page}`);
      if (!meta.hasMore) {
        assert.equal(ids.length, meta.total, `${path}: every row once`);
        assert.equal(new Set(ids).size, ids.length, `${path}: no row repeated`);
        return ids.sort();
      }
    }
  }

  const sorted = (rows: { id: string }[]) => rows.map((row) => row.id).sort();

  it('API-05: wallets, accounts, categories, members and invitations page without repeating or skipping a row', async () => {
    const owner = await registerProbeUser(api, 'paging-owner');
    for (let i = 0; i < 2; i += 1) {
      assert.equal((await api.call('POST', '/wallets', { token: owner.token, body: { name: `probe-${randomUUID()}`, timeZone: 'Asia/Ho_Chi_Minh' } })).status, 201);
      await createAccount(api, owner, owner.walletId);
      await addMember(api, owner, owner.walletId, await registerProbeUser(api, `paging-member-${i}`), 'VIEWER');
    }
    for (let i = 0; i < 3; i += 1) {
      const invite = await api.call('POST', `/wallets/${owner.walletId}/invitations`, {
        token: owner.token,
        body: { email: `probe+paging-invite-${randomUUID()}@example.invalid`, role: 'VIEWER' },
      });
      assert.equal(invite.status, 201);
    }

    assert.deepEqual(
      await walk(owner, '/wallets'),
      sorted(await api.sql("SELECT w.id FROM wallets w JOIN wallet_members m ON m.wallet_id = w.id WHERE m.user_id = $1 AND m.status = 'ACTIVE'", [owner.id])),
    );
    assert.deepEqual(await walk(owner, `/accounts?walletId=${owner.walletId}`), sorted(await api.sql('SELECT id FROM accounts WHERE wallet_id = $1', [owner.walletId])));
    assert.deepEqual(
      await walk(owner, `/categories?walletId=${owner.walletId}`, 10),
      sorted(await api.sql('SELECT id FROM categories WHERE wallet_id = $1', [owner.walletId])),
    );
    assert.deepEqual(
      await walk(owner, `/wallets/${owner.walletId}/members`),
      sorted(await api.sql("SELECT id FROM wallet_members WHERE wallet_id = $1 AND status = 'ACTIVE'", [owner.walletId])),
    );
    assert.deepEqual(
      await walk(owner, `/wallets/${owner.walletId}/invitations`),
      sorted(await api.sql('SELECT id FROM wallet_invitations WHERE wallet_id = $1 AND accepted_at IS NULL AND revoked_at IS NULL', [owner.walletId])),
    );
  });

  it('API-05: the category tree comes back whole, unpaged, since a page of it would split children from parents', async () => {
    const user = await registerProbeUser(api, 'paging-tree');
    const tree = await api.call('GET', `/categories?walletId=${user.walletId}&tree=true&pageSize=1`, { token: user.token });
    assert.equal(tree.status, 200);
    assert.equal(tree.body!.meta?.pagination, undefined);
    const [roots] = await api.sql<{ count: string }>('SELECT count(*)::text AS count FROM categories WHERE wallet_id = $1 AND parent_id IS NULL', [user.walletId]);
    assert.equal(tree.body!.data.length, Number(roots!.count));
  });
});
