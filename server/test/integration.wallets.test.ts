import { strict as assert } from 'node:assert';
import { randomUUID } from 'node:crypto';
import { after, before, describe, it } from 'node:test';

import { parseMoney } from '@sora/contracts';

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

/** Wallets (§6), members (§7), invitations (§8) and the audit trail (§15) over HTTP. */
describe('wallets, members and the audit trail against a real database', { skip: integrationSkipReason() }, () => {
  let api: TestApi;

  before(async () => {
    api = await startTestApi();
  });

  after(async () => {
    await api?.close();
  });

  async function invite(owner: ProbeUser, walletId: string, email: string, role: 'EDITOR' | 'VIEWER', relationLabel?: string) {
    const created = await api.call('POST', `/wallets/${walletId}/invitations`, {
      token: owner.token,
      body: { email, role, ...(relationLabel ? { relationLabel } : {}) },
    });
    assert.equal(created.status, 201, JSON.stringify(created.body));
    return created.body!.data as { id: string; token: string; expiresAt: string; walletName: string };
  }

  async function memberIdOf(owner: ProbeUser, walletId: string, userId: string): Promise<string> {
    const members = await api.call('GET', `/wallets/${walletId}/members`, { token: owner.token });
    return members.body!.data.find((member: { userId: string }) => member.userId === userId).id;
  }

  async function auditTrail(owner: ProbeUser, walletId: string, query = 'pageSize=200') {
    const response = await api.call('GET', `/wallets/${walletId}/audit-logs?${query}`, { token: owner.token });
    assert.equal(response.status, 200, JSON.stringify(response.body));
    return response;
  }

  async function newWallet(user: ProbeUser): Promise<string> {
    const created = await api.call('POST', '/wallets', { token: user.token, body: { name: `probe-${randomUUID()}`, timeZone: 'Asia/Ho_Chi_Minh' } });
    assert.equal(created.status, 201);
    return created.body!.data.id;
  }

  it('WAL-US-01: creates a wallet with the creator as its OWNER, audited, and rejects a bad name', async () => {
    const user = await registerProbeUser(api, 'wal-create');
    const name = `probe-${randomUUID()}`;

    const created = await api.call('POST', '/wallets', { token: user.token, body: { name: `  ${name}  `, timeZone: 'Asia/Ho_Chi_Minh' } });
    assert.equal(created.status, 201);
    const wallet = created.body!.data;
    assert.equal(wallet.name, name, 'the name is trimmed');
    assert.equal(wallet.status, 'ACTIVE');
    assert.equal(wallet.ownerUserId, user.id);
    assert.equal(wallet.role, 'OWNER');
    assert.equal(wallet.isOwn, true);
    assert.deepEqual(wallet.balances, []);

    const membership = await api.sql<{ role: string; status: string }>(
      'SELECT role, status FROM wallet_members WHERE wallet_id = $1 AND user_id = $2',
      [wallet.id, user.id],
    );
    assert.deepEqual(membership, [{ role: 'OWNER', status: 'ACTIVE' }]);

    const trail = await auditTrail(user, wallet.id, 'event=WALLET_CREATED');
    assert.deepEqual(
      trail.body!.data.map((row: { entityId: string; actorId: string; actorRole: string; result: string }) => [row.entityId, row.actorId, row.actorRole, row.result]),
      [[wallet.id, user.id, 'OWNER', 'SUCCESS']],
    );

    const longest = await api.call('POST', '/wallets', { token: user.token, body: { name: 'w'.repeat(100), timeZone: 'Asia/Ho_Chi_Minh' } });
    assert.equal(longest.status, 201, '100 characters is within the limit');

    for (const bad of ['', '   ', 'w'.repeat(101)]) {
      const rejected = await api.call('POST', '/wallets', { token: user.token, body: { name: bad, timeZone: 'Asia/Ho_Chi_Minh' } });
      assert.deepEqual([rejected.status, rejected.body?.error?.code], [422, 'VALIDATION_FAILED'], `name of length ${bad.length}`);
    }
  });

  it('WAL-US-02: lists own and shared wallets with the caller\'s own role and label, per-currency balances, archived only when asked', async () => {
    const me = await registerProbeUser(api, 'wal-list-me');
    const partner = await registerProbeUser(api, 'wal-list-partner');
    const otherMember = await registerProbeUser(api, 'wal-list-other');
    const stranger = await registerProbeUser(api, 'wal-list-stranger');

    await createAccount(api, me, me.walletId, { currency: 'VND', initialBalance: '1500000' });
    await createAccount(api, me, me.walletId, { currency: 'USD', initialBalance: '25.5' });

    const offer = await invite(partner, partner.walletId, me.email, 'VIEWER', 'Girlfriend');
    assert.equal((await api.call('POST', '/invitations/accept', { token: me.token, body: { token: offer.token } })).status, 200);
    const otherOffer = await invite(partner, partner.walletId, otherMember.email, 'EDITOR', 'Brother');
    await api.call('POST', '/invitations/accept', { token: otherMember.token, body: { token: otherOffer.token } });

    const archivedId = await newWallet(me);
    assert.equal((await api.call('DELETE', `/wallets/${archivedId}`, { token: me.token })).status, 204);

    const listed = await api.call('GET', '/wallets', { token: me.token });
    assert.equal(listed.status, 200);
    const byId = new Map(listed.body!.data.map((wallet: { id: string }) => [wallet.id, wallet]));
    assert.deepEqual([...byId.keys()].sort(), [me.walletId, partner.walletId].sort(), 'archived and unrelated wallets are absent');
    assert.ok(!byId.has(stranger.walletId));

    const own = byId.get(me.walletId) as Record<string, any>;
    assert.deepEqual([own.role, own.isOwn, own.relationLabel], ['OWNER', true, null]);
    const shared = byId.get(partner.walletId) as Record<string, any>;
    assert.deepEqual([shared.role, shared.isOwn, shared.relationLabel], ['VIEWER', false, 'Girlfriend'], 'my label, not the other member\'s');

    assert.ok(Array.isArray(own.balances));
    const balances = new Map(own.balances.map((entry: { currency: string; amount: string }) => [entry.currency, entry.amount]));
    assert.deepEqual([...balances.keys()].sort(), ['USD', 'VND']);
    for (const amount of balances.values()) assert.equal(typeof amount, 'string', 'money is a string on the wire');
    assert.equal(parseMoney(balances.get('VND') as string), parseMoney('1500000'));
    assert.equal(parseMoney(balances.get('USD') as string), parseMoney('25.5'));
    assert.ok(!('total' in own) && !('balance' in own), 'no cross-currency total');

    const archived = await api.call('GET', '/wallets?status=ARCHIVED', { token: me.token });
    assert.deepEqual(archived.body!.data.map((wallet: { id: string }) => wallet.id), [archivedId]);
  });

  it('WAL-US-03: refuses to invite an address that already belongs to an active member', async () => {
    const owner = await registerProbeUser(api, 'wal-dup-owner');
    const member = await registerProbeUser(api, 'wal-dup-member');
    await addMember(api, owner, owner.walletId, member, 'VIEWER');

    for (const email of [member.email, member.email.toUpperCase(), owner.email]) {
      const again = await api.call('POST', `/wallets/${owner.walletId}/invitations`, { token: owner.token, body: { email, role: 'EDITOR' } });
      assert.deepEqual([again.status, again.body?.error?.code], [409, 'MEMBER_ALREADY_EXISTS'], email);
    }
    const open = await api.sql('SELECT 1 FROM wallet_invitations WHERE wallet_id = $1 AND accepted_at IS NULL AND revoked_at IS NULL', [owner.walletId]);
    assert.equal(open.length, 0, 'no invitation was stored');
  });

  it('WAL-US-04: previews a live invitation publicly with wallet name, role, expiry and a masked address only', async () => {
    const owner = await registerProbeUser(api, 'wal-preview');
    const email = `probe+wal-preview-guest-${randomUUID()}@example.invalid`;
    const offer = await invite(owner, owner.walletId, email, 'EDITOR');

    const preview = await api.call('POST', '/invitations/preview', { body: { token: offer.token } });
    assert.equal(preview.status, 200);
    const data = preview.body!.data;
    assert.deepEqual(Object.keys(data).sort(), ['expiresAt', 'invitedEmail', 'role', 'walletName'], 'no ids or token');
    assert.equal(data.walletName, offer.walletName);
    assert.equal(data.role, 'EDITOR');
    assert.equal(data.expiresAt, offer.expiresAt);
    const days = (Date.parse(data.expiresAt) - Date.now()) / 86_400_000;
    assert.ok(days > 6.9 && days <= 7, `expires in 7 days, got ${days}`);
    assert.equal(data.invitedEmail, `p***@example.invalid`, 'local part hidden, domain kept');
  });

  it('WAL-US-04: reports an unknown, expired or used token instead of previewing it', async () => {
    const owner = await registerProbeUser(api, 'wal-preview-bad');
    const unknown = await api.call('POST', '/invitations/preview', { body: { token: `probe-${randomUUID()}` } });
    assert.deepEqual([unknown.status, unknown.body?.error?.code], [404, 'INVITATION_NOT_FOUND']);

    const expired = await invite(owner, owner.walletId, `probe+wal-exp-${randomUUID()}@example.invalid`, 'VIEWER');
    await api.sql("UPDATE wallet_invitations SET expires_at = now() - interval '1 minute' WHERE id = $1", [expired.id]);
    const expiredPreview = await api.call('POST', '/invitations/preview', { body: { token: expired.token } });
    assert.deepEqual([expiredPreview.status, expiredPreview.body?.error?.code], [410, 'INVITATION_EXPIRED']);

    const guest = await registerProbeUser(api, 'wal-preview-used');
    const used = await invite(owner, owner.walletId, guest.email, 'VIEWER');
    await api.call('POST', '/invitations/accept', { token: guest.token, body: { token: used.token } });
    const usedPreview = await api.call('POST', '/invitations/preview', { body: { token: used.token } });
    assert.deepEqual([usedPreview.status, usedPreview.body?.error?.code], [409, 'INVITATION_ALREADY_USED']);
  });

  it('WAL-US-05: an accepted wallet appears in the accepter\'s list with role and label, and acceptance is audited', async () => {
    const owner = await registerProbeUser(api, 'wal-accept-owner');
    const guest = await registerProbeUser(api, 'wal-accept-guest');
    const offer = await invite(owner, owner.walletId, guest.email, 'EDITOR', 'Mom');

    const accepted = await api.call('POST', '/invitations/accept', { token: guest.token, body: { token: offer.token } });
    assert.equal(accepted.status, 200);
    assert.deepEqual([accepted.body!.data.id, accepted.body!.data.role], [owner.walletId, 'EDITOR']);

    const listed = await api.call('GET', '/wallets', { token: guest.token });
    const shared = listed.body!.data.find((wallet: { id: string }) => wallet.id === owner.walletId);
    assert.ok(shared, 'the shared wallet is listed immediately');
    assert.deepEqual([shared.role, shared.relationLabel, shared.isOwn], ['EDITOR', 'Mom', false]);

    const trail = await auditTrail(owner, owner.walletId, 'event=INVITATION_ACCEPTED');
    assert.deepEqual(
      trail.body!.data.map((row: { entityId: string; actorId: string; result: string }) => [row.entityId, row.actorId, row.result]),
      [[offer.id, guest.id, 'SUCCESS']],
    );
  });

  it('WAL-US-06: refuses to revoke an invitation that was already accepted, leaving the membership in place', async () => {
    const owner = await registerProbeUser(api, 'wal-revoke-used');
    const guest = await registerProbeUser(api, 'wal-revoke-used-g');
    const offer = await invite(owner, owner.walletId, guest.email, 'VIEWER');
    await api.call('POST', '/invitations/accept', { token: guest.token, body: { token: offer.token } });

    const revoked = await api.call('DELETE', `/wallets/${owner.walletId}/invitations/${offer.id}`, { token: owner.token });
    assert.deepEqual([revoked.status, revoked.body?.error?.code], [409, 'INVITATION_ALREADY_USED']);
    const [membership] = await api.sql<{ status: string }>('SELECT status FROM wallet_members WHERE wallet_id = $1 AND user_id = $2', [owner.walletId, guest.id]);
    assert.equal(membership?.status, 'ACTIVE');
  });

  it('WAL-US-07: a VIEWER reads the member list with no credential, revoked members only when asked', async () => {
    const owner = await registerProbeUser(api, 'wal-members-owner');
    const viewer = await registerProbeUser(api, 'wal-members-viewer');
    const removed = await registerProbeUser(api, 'wal-members-removed');
    const offer = await invite(owner, owner.walletId, viewer.email, 'VIEWER', 'Partner');
    await api.call('POST', '/invitations/accept', { token: viewer.token, body: { token: offer.token } });
    await addMember(api, owner, owner.walletId, removed, 'EDITOR');
    await api.call('DELETE', `/wallets/${owner.walletId}/members/${await memberIdOf(owner, owner.walletId, removed.id)}`, { token: owner.token });

    const listed = await api.call('GET', `/wallets/${owner.walletId}/members`, { token: viewer.token });
    assert.equal(listed.status, 200);
    const members = listed.body!.data as Array<Record<string, any>>;
    for (const member of members) {
      assert.deepEqual(
        Object.keys(member).sort(),
        ['displayName', 'email', 'id', 'joinedAt', 'relationLabel', 'role', 'status', 'userId', 'walletId'],
        'no password hash, token or other credential',
      );
      assert.ok(!Number.isNaN(Date.parse(member.joinedAt)));
    }
    assert.deepEqual(members.map((member) => member.userId).sort(), [owner.id, viewer.id].sort(), 'the removed member is not listed by default');
    const viewerEntry = members.find((member) => member.userId === viewer.id)!;
    assert.deepEqual(
      [viewerEntry.email, viewerEntry.displayName, viewerEntry.role, viewerEntry.relationLabel, viewerEntry.status],
      [viewer.email, 'probe-wal-members-viewer', 'VIEWER', 'Partner', 'ACTIVE'],
    );

    const revoked = await api.call('GET', `/wallets/${owner.walletId}/members?status=REVOKED`, { token: viewer.token });
    assert.deepEqual(revoked.body!.data.map((member: { userId: string; status: string }) => [member.userId, member.status]), [[removed.id, 'REVOKED']]);
  });

  it('WAL-US-08: lowering an EDITOR to VIEWER takes effect on their next write, audited with old and new role', async () => {
    const owner = await registerProbeUser(api, 'wal-demote-owner');
    const editor = await registerProbeUser(api, 'wal-demote-editor');
    await addMember(api, owner, owner.walletId, editor, 'EDITOR');
    await createAccount(api, editor, owner.walletId);
    const memberId = await memberIdOf(owner, owner.walletId, editor.id);

    const changed = await api.call('PATCH', `/wallets/${owner.walletId}/members/${memberId}`, { token: owner.token, body: { role: 'VIEWER' } });
    assert.equal(changed.status, 200);
    assert.equal(changed.body!.data.role, 'VIEWER');

    const write = await api.call('POST', '/accounts', {
      token: editor.token,
      body: { walletId: owner.walletId, name: `probe-${randomUUID()}`, type: 'BANK_ACCOUNT', currency: 'VND', initialBalance: '0' },
    });
    assert.deepEqual([write.status, write.body?.error?.code], [403, 'FORBIDDEN']);

    const trail = await auditTrail(owner, owner.walletId, 'event=MEMBER_ROLE_CHANGED');
    assert.equal(trail.body!.data.length, 1);
    const [row] = trail.body!.data;
    assert.equal(row.entityId, memberId);
    assert.match(row.note, /EDITOR/);
    assert.match(row.note, /VIEWER/);
    assert.ok(row.note.indexOf('EDITOR') < row.note.indexOf('VIEWER'), 'old role before new');
  });

  it('WAL-US-10: refuses to hand ownership to a non-member or a revoked member', async () => {
    const owner = await registerProbeUser(api, 'wal-heir-owner');
    const stranger = await registerProbeUser(api, 'wal-heir-stranger');
    const former = await registerProbeUser(api, 'wal-heir-former');
    await addMember(api, owner, owner.walletId, former, 'EDITOR');
    await api.call('DELETE', `/wallets/${owner.walletId}/members/${await memberIdOf(owner, owner.walletId, former.id)}`, { token: owner.token });

    for (const target of [stranger, former]) {
      const response = await api.call('POST', `/wallets/${owner.walletId}/transfer-ownership`, { token: owner.token, body: { toUserId: target.id } });
      assert.deepEqual([response.status, response.body?.error?.code], [404, 'MEMBER_NOT_FOUND']);
    }
    const owners = await api.sql<{ user_id: string }>(
      "SELECT user_id FROM wallet_members WHERE wallet_id = $1 AND role = 'OWNER' AND status = 'ACTIVE'",
      [owner.walletId],
    );
    assert.deepEqual(owners.map((row) => row.user_id), [owner.id]);
  });

  it('WAL-US-11: an EDITOR who leaves is revoked and loses the wallet, while their entries still name them', async () => {
    const owner = await registerProbeUser(api, 'wal-leave-owner');
    const editor = await registerProbeUser(api, 'wal-leave-editor');
    await addMember(api, owner, owner.walletId, editor, 'EDITOR');
    const account = await createAccount(api, owner, owner.walletId, { initialBalance: '100000' });
    const recorded = await api.call('POST', '/transactions', {
      token: editor.token,
      body: {
        type: 'EXPENSE',
        fromAccountId: account,
        categoryId: await categoryOf(api, owner, owner.walletId, 'EXPENSE'),
        amount: '2500',
        currency: 'VND',
        transactionDate: nowIso(),
      },
    });
    assert.equal(recorded.status, 201, JSON.stringify(recorded.body));
    const memberId = await memberIdOf(owner, owner.walletId, editor.id);

    const left = await api.call('POST', `/wallets/${owner.walletId}/leave`, { token: editor.token, body: {} });
    assert.equal(left.status, 204);

    const [membership] = await api.sql<{ status: string }>('SELECT status FROM wallet_members WHERE id = $1', [memberId]);
    assert.equal(membership?.status, 'REVOKED', 'the row stays, revoked');
    const listed = await api.call('GET', '/wallets', { token: editor.token });
    assert.ok(!listed.body!.data.some((wallet: { id: string }) => wallet.id === owner.walletId));
    assert.equal((await api.call('GET', `/wallets/${owner.walletId}`, { token: editor.token })).status, 404);

    const entry = await api.call('GET', `/transactions/${recorded.body!.data.id}`, { token: owner.token });
    assert.equal(entry.status, 200);
    assert.deepEqual(entry.body!.data.createdBy, { id: editor.id, displayName: 'probe-wal-leave-editor' });

    const trail = await auditTrail(owner, owner.walletId, 'event=MEMBER_LEFT');
    assert.deepEqual(
      trail.body!.data.map((row: { entityId: string; actorId: string; actorRole: string }) => [row.entityId, row.actorId, row.actorRole]),
      [[memberId, editor.id, 'EDITOR']],
    );
  });

  it('WAL-US-13: filters the trail by event and date range, and pages it without repeats', async () => {
    const owner = await registerProbeUser(api, 'wal-trail');
    for (let i = 0; i < 3; i++) await createAccount(api, owner, owner.walletId);

    const accounts = await auditTrail(owner, owner.walletId, 'event=ACCOUNT_CREATED');
    assert.equal(accounts.body!.data.length, 3);
    assert.ok(accounts.body!.data.every((row: { event: string }) => row.event === 'ACCOUNT_CREATED'));

    const all = await auditTrail(owner, owner.walletId);
    const total = all.body!.meta.pagination.total as number;
    assert.ok(total >= 4, 'wallet creation plus three accounts');
    const day = (all.body!.data[0].createdAt as string).slice(0, 10);
    const previous = new Date(`${day}T00:00:00Z`);
    previous.setUTCDate(previous.getUTCDate() - 1);
    const yesterday = previous.toISOString().slice(0, 10);

    const sameDay = await auditTrail(owner, owner.walletId, `dateFrom=${day}&dateTo=${day}&pageSize=200`);
    assert.equal(sameDay.body!.data.length, all.body!.data.filter((row: { createdAt: string }) => row.createdAt.startsWith(day)).length);
    assert.ok(sameDay.body!.data.length > 0, 'dateTo is inclusive of the whole day');
    const beforeIt = await auditTrail(owner, owner.walletId, `dateTo=${yesterday}`);
    assert.equal(beforeIt.body!.data.length, 0);
    const fromTomorrow = new Date(`${day}T00:00:00Z`);
    fromTomorrow.setUTCDate(fromTomorrow.getUTCDate() + 1);
    const afterIt = await auditTrail(owner, owner.walletId, `dateFrom=${fromTomorrow.toISOString().slice(0, 10)}`);
    assert.equal(afterIt.body!.data.length, 0);

    const first = await auditTrail(owner, owner.walletId, 'page=1&pageSize=2');
    const second = await auditTrail(owner, owner.walletId, 'page=2&pageSize=2');
    assert.deepEqual(first.body!.meta.pagination, { page: 1, pageSize: 2, total, hasMore: true });
    assert.equal(first.body!.data.length, 2);
    const firstIds = new Set(first.body!.data.map((row: { id: string }) => row.id));
    assert.ok(second.body!.data.every((row: { id: string }) => !firstIds.has(row.id)), 'pages do not overlap');
    assert.ok(second.body!.data.length > 0);
  });

  it('WAL-US-13: lists a denied attempt alongside the successes', async () => {
    const owner = await registerProbeUser(api, 'wal-trail-denied');
    const viewer = await registerProbeUser(api, 'wal-trail-denied-v');
    await addMember(api, owner, owner.walletId, viewer, 'VIEWER');

    const denied = await api.call('POST', `/wallets/${owner.walletId}/invitations`, {
      token: viewer.token,
      body: { email: `probe+wal-denied-${randomUUID()}@example.invalid`, role: 'VIEWER' },
    });
    assert.equal(denied.status, 403);

    const trail = await auditTrail(owner, owner.walletId);
    const results = trail.body!.data.map((row: { result: string; actorId: string }) => [row.result, row.actorId]);
    assert.ok(results.some(([result]: string[]) => result === 'SUCCESS'));
    assert.ok(
      results.some(([result, actor]: string[]) => result === 'DENIED' && actor === viewer.id),
      `expected a DENIED row for the viewer, got ${JSON.stringify(results)}`,
    );

    const stranger = await registerProbeUser(api, 'wal-trail-denied-s');
    const hidden = await api.call('POST', `/wallets/${owner.walletId}/invitations`, {
      token: stranger.token,
      body: { email: `probe+wal-denied-${randomUUID()}@example.invalid`, role: 'VIEWER' },
    });
    assert.equal(hidden.status, 404);
    const strangerRows = await api.sql('SELECT id FROM audit_logs WHERE actor_id = $1 AND event = $2', [stranger.id, 'ACCESS_DENIED']);
    assert.deepEqual(strangerRows, [], "a non-member's 404 is not recorded: no wallet resolved for them (AC-01)");
  });

  it('WAL-US-02: honours includeOwn=false and includeShared=false, and refuses a flag that is not true or false', async () => {
    const owner = await registerProbeUser(api, 'wal-flags-owner');
    const member = await registerProbeUser(api, 'wal-flags-member');
    await addMember(api, owner, owner.walletId, member, 'VIEWER');
    const ids = async (query: string) =>
      ((await api.call('GET', `/wallets?${query}`, { token: member.token })).body!.data as { id: string }[]).map((wallet) => wallet.id);

    assert.deepEqual(await ids('includeOwn=false'), [owner.walletId]);
    assert.deepEqual(await ids('includeShared=false'), [member.walletId]);
    assert.equal((await api.call('GET', '/wallets?includeOwn=0', { token: member.token })).status, 422);
  });
});
