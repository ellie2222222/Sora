import { strict as assert } from 'node:assert';
import { randomUUID } from 'node:crypto';
import { after, before, describe, it } from 'node:test';

import { addMember, createAccount, integrationSkipReason, registerProbeUser, startTestApi, type ProbeUser, type TestApi } from './support/integration.ts';

const IN_WINDOW = '2026-07-15T09:00:00.000Z';

/** CAT-US-01..04 and the permanent delete of API spec §10.4, over HTTP. */
describe('categories against a real database', { skip: integrationSkipReason() }, () => {
  let api: TestApi;
  let user: ProbeUser;
  let account = '';

  const create = (body: Record<string, unknown>, owner: ProbeUser = user) =>
    api.call('POST', '/categories', { token: owner.token, body: { walletId: owner.walletId, name: `probe-${randomUUID()}`, type: 'EXPENSE', ...body } });
  const idOf = async (body: Record<string, unknown> = {}) => {
    const response = await create(body);
    assert.equal(response.status, 201, JSON.stringify(response.body));
    return response.body!.data.id as string;
  };
  const statusOf = async (id: string) => (await api.sql<{ status: string }>('SELECT status FROM categories WHERE id = $1', [id]))[0]?.status;
  const spendOn = (categoryId: string) =>
    api.call('POST', '/transactions', {
      token: user.token,
      body: { type: 'EXPENSE', fromAccountId: account, categoryId, amount: '1', currency: 'VND', transactionDate: IN_WINDOW },
    });
  const budgetOn = (categoryId: string) =>
    api.call('POST', '/budgets', {
      token: user.token,
      body: { walletId: user.walletId, categoryId, name: `probe-${randomUUID()}`, amount: '100', currency: 'VND', periodType: 'CUSTOM', startDate: '2026-07-01', endDate: '2026-07-31' },
    });

  before(async () => {
    api = await startTestApi();
    user = await registerProbeUser(api, 'categories');
    account = await createAccount(api, user, user.walletId, { initialBalance: '1000' });
  });

  after(async () => {
    await api?.close();
  });

  it('CAT-US-01: filters by type and status, and nests children under their parent with tree=true', async () => {
    const parent = await idOf();
    const child = await idOf({ parentId: parent });
    const retired = await idOf();
    assert.equal((await api.call('DELETE', `/categories/${retired}`, { token: user.token })).status, 204);

    const tree = await api.call('GET', `/categories?walletId=${user.walletId}&type=EXPENSE&status=ACTIVE&tree=true`, { token: user.token });
    assert.equal(tree.status, 200);
    const roots = tree.body!.data as { id: string; type: string; status: string; children: { id: string }[] }[];
    assert.ok(roots.every((root) => root.type === 'EXPENSE' && root.status === 'ACTIVE'));
    assert.deepEqual(roots.find((root) => root.id === parent)?.children.map((node) => node.id), [child]);
    assert.ok(!roots.some((root) => root.id === child || root.id === retired), 'a child is not also a root; an archived one is filtered out');

    const flat = await api.call('GET', `/categories?walletId=${user.walletId}&tree=false`, { token: user.token });
    assert.ok(flat.body!.data.some((row: { id: string }) => row.id === child), 'tree=false lists children flat, not nested');
    assert.equal((await api.call('GET', `/categories?walletId=${user.walletId}&tree=yes`, { token: user.token })).status, 422);

    const archived = await api.call('GET', `/categories?walletId=${user.walletId}&status=ARCHIVED`, { token: user.token });
    const archivedRows = archived.body!.data as { id: string; status: string }[];
    assert.ok(archivedRows.some((row) => row.id === retired) && archivedRows.every((row) => row.status === 'ARCHIVED'));
  });

  it('CAT-US-02: refuses a parent of the other type, in another wallet, or in a wallet the caller cannot see (AC-01)', async () => {
    const income = await idOf({ type: 'INCOME' });
    const wrongType = await create({ parentId: income });
    assert.deepEqual([wrongType.status, wrongType.body?.error?.code], [422, 'CATEGORY_WRONG_TYPE']);

    const partner = await registerProbeUser(api, 'categories-partner');
    const theirs = (await create({}, partner)).body!.data.id as string;
    const unseen = await create({ parentId: theirs });
    assert.deepEqual([unseen.status, unseen.body?.error?.code], [404, 'CATEGORY_NOT_FOUND']);

    await addMember(api, partner, partner.walletId, user, 'EDITOR');
    const wrongWallet = await create({ parentId: theirs });
    assert.deepEqual([wrongWallet.status, wrongWallet.body?.error?.code], [403, 'CATEGORY_WRONG_WALLET']);
  });

  it('CAT-US-02: refuses a sibling name differing only in case, but allows the same name in another wallet (VL-02)', async () => {
    const name = `probe-dup-${randomUUID()}`;
    await idOf({ name });
    const duplicate = await create({ name: name.toUpperCase() });
    assert.deepEqual([duplicate.status, duplicate.body?.error?.code], [409, 'CATEGORY_DUPLICATE_NAME']);

    const elsewhere = await registerProbeUser(api, 'categories-elsewhere');
    assert.equal((await create({ name }, elsewhere)).status, 201);
  });

  it('CAT-US-02: audits a create, and refuses a VIEWER (403, not 404: membership is established)', async () => {
    const id = await idOf();
    assert.equal((await api.sql('SELECT id FROM audit_logs WHERE entity_id = $1 AND event = $2', [id, 'CATEGORY_CREATED'])).length, 1);

    const viewer = await registerProbeUser(api, 'categories-viewer');
    await addMember(api, user, user.walletId, viewer, 'VIEWER');
    const refused = await api.call('POST', '/categories', { token: viewer.token, body: { walletId: user.walletId, name: `probe-${randomUUID()}`, type: 'EXPENSE' } });
    assert.deepEqual([refused.status, refused.body?.error?.code], [403, 'FORBIDDEN']);
  });

  it('CAT-US-03: refuses a rename onto a sibling, allows re-casing its own name, and never changes type or parent', async () => {
    const parent = await idOf();
    const taken = `probe-taken-${randomUUID()}`;
    await idOf({ parentId: parent, name: taken });
    const id = await idOf({ parentId: parent, name: `probe-own-${randomUUID()}` });

    const onto = await api.call('PATCH', `/categories/${id}`, { token: user.token, body: { name: taken } });
    assert.deepEqual([onto.status, onto.body?.error?.code], [409, 'CATEGORY_DUPLICATE_NAME']);

    const recased = `PROBE-OWN-${randomUUID()}`;
    const renamed = await api.call('PATCH', `/categories/${id}`, { token: user.token, body: { name: recased, type: 'INCOME', parentId: null } });
    assert.equal(renamed.status, 200);
    assert.deepEqual([renamed.body!.data.name, renamed.body!.data.type, renamed.body!.data.parentId], [recased, 'EXPENSE', parent]);
  });

  it('CAT-US-04: archives the subtree, refuses while an active budget plans for it, by DELETE or by PATCH', async () => {
    const parent = await idOf();
    const child = await idOf({ parentId: parent });
    const budget = await budgetOn(parent);
    assert.equal(budget.status, 201);

    const byDelete = await api.call('DELETE', `/categories/${parent}`, { token: user.token });
    assert.deepEqual([byDelete.status, byDelete.body?.error?.code], [409, 'CATEGORY_IN_USE']);
    const byPatch = await api.call('PATCH', `/categories/${parent}`, { token: user.token, body: { status: 'ARCHIVED' } });
    assert.deepEqual([byPatch.status, byPatch.body?.error?.code], [409, 'CATEGORY_IN_USE']);
    assert.deepEqual([await statusOf(parent), await statusOf(child)], ['ACTIVE', 'ACTIVE']);

    assert.equal((await api.call('DELETE', `/budgets/${budget.body!.data.id}`, { token: user.token })).status, 204);
    const archived = await api.call('PATCH', `/categories/${parent}`, { token: user.token, body: { status: 'ARCHIVED' } });
    assert.equal(archived.status, 200);
    assert.deepEqual([await statusOf(parent), await statusOf(child)], ['ARCHIVED', 'ARCHIVED'], 'the child goes with it');
    assert.equal((await api.sql('SELECT id FROM audit_logs WHERE entity_id = $1 AND event = $2', [parent, 'CATEGORY_ARCHIVED'])).length, 1);
  });

  it('CAT-US-03: refuses restoring a child while its parent is archived, and allows it once the parent is back', async () => {
    const parent = await idOf();
    const child = await idOf({ parentId: parent });
    assert.equal((await api.call('DELETE', `/categories/${parent}`, { token: user.token })).status, 204);
    const restore = (id: string) => api.call('PATCH', `/categories/${id}`, { token: user.token, body: { status: 'ACTIVE' } });

    const refused = await restore(child);
    assert.deepEqual([refused.status, refused.body?.error?.code], [409, 'CATEGORY_PARENT_ARCHIVED']);
    assert.equal(await statusOf(child), 'ARCHIVED');
    assert.equal((await restore(parent)).status, 200);
    assert.equal((await restore(child)).body?.data.status, 'ACTIVE');
  });

  it('CAT-US-04: refuses archiving a parent while an active budget plans for one of its children', async () => {
    const parent = await idOf();
    const child = await idOf({ parentId: parent });
    assert.equal((await budgetOn(child)).status, 201);

    for (const archive of [
      () => api.call('DELETE', `/categories/${parent}`, { token: user.token }),
      () => api.call('PATCH', `/categories/${parent}`, { token: user.token, body: { status: 'ARCHIVED' } }),
    ]) {
      const refused = await archive();
      assert.deepEqual([refused.status, refused.body?.error?.code], [409, 'CATEGORY_IN_USE']);
    }
    assert.deepEqual([await statusOf(parent), await statusOf(child)], ['ACTIVE', 'ACTIVE']);
  });

  it('CAT-US-04: a historical transaction still reads with its archived category', async () => {
    const id = await idOf();
    const spent = await spendOn(id);
    assert.equal(spent.status, 201);
    assert.equal((await api.call('DELETE', `/categories/${id}`, { token: user.token })).status, 204);

    const read = await api.call('GET', `/transactions/${spent.body!.data.id}`, { token: user.token });
    assert.deepEqual([read.status, read.body?.data.category?.id], [200, id]);
  });

  it('§10.4: deletes permanently only an unused subtree, and audits it as CATEGORY_DELETED', async () => {
    const used = await idOf();
    assert.equal((await spendOn(used)).status, 201);
    const withUsedChild = await idOf();
    assert.equal((await spendOn(await idOf({ parentId: withUsedChild }))).status, 201);
    for (const id of [used, withUsedChild]) {
      const refused = await api.call('DELETE', `/categories/${id}?mode=permanent`, { token: user.token });
      assert.deepEqual([refused.status, refused.body?.error?.code], [409, 'CATEGORY_HAS_TRANSACTIONS']);
      assert.equal(await statusOf(id), 'ACTIVE');
    }

    const unused = await idOf();
    const unusedChild = await idOf({ parentId: unused });
    assert.equal((await api.call('DELETE', `/categories/${unused}?mode=permanent`, { token: user.token })).status, 204);
    assert.deepEqual(await api.sql('SELECT id FROM categories WHERE id = ANY($1)', [[unused, unusedChild]]), []);
    const events = await api.sql<{ event: string }>('SELECT event FROM audit_logs WHERE entity_id = $1', [unused]);
    assert.ok(events.some((row) => row.event === 'CATEGORY_DELETED'));
    assert.ok(!events.some((row) => row.event === 'CATEGORY_ARCHIVED'));
  });
});
