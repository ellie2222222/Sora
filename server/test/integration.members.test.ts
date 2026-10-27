import { strict as assert } from 'node:assert';
import { randomUUID } from 'node:crypto';
import { after, before, describe, it } from 'node:test';

import { addMember, integrationSkipReason, registerProbeUser, startTestApi, type ProbeUser, type TestApi } from './support/integration.ts';

/** BR-01 (one active owner, demote before promote) and BR-08 (invitations) over HTTP. */
describe('membership and invitations against a real database', { skip: integrationSkipReason() }, () => {
  let api: TestApi;

  before(async () => {
    api = await startTestApi();
  });

  after(async () => {
    await api?.close();
  });

  async function memberIdOf(owner: ProbeUser, walletId: string, userId: string): Promise<string> {
    const members = await api.call('GET', `/wallets/${walletId}/members`, { token: owner.token });
    return members.body!.data.find((member: { userId: string }) => member.userId === userId).id;
  }

  async function activeOwners(walletId: string): Promise<string[]> {
    return (
      await api.sql<{ user_id: string }>(
        "SELECT user_id FROM wallet_members WHERE wallet_id = $1 AND role = 'OWNER' AND status = 'ACTIVE'",
        [walletId],
      )
    ).map((row) => row.user_id);
  }

  it('transfers ownership by demoting the old owner before promoting the new one', async () => {
    const owner = await registerProbeUser(api, 'own-from');
    const heir = await registerProbeUser(api, 'own-to');
    await addMember(api, owner, owner.walletId, heir, 'EDITOR');

    const response = await api.call('POST', `/wallets/${owner.walletId}/transfer-ownership`, { token: owner.token, body: { toUserId: heir.id } });
    assert.equal(response.status, 200);
    assert.deepEqual(await activeOwners(owner.walletId), [heir.id]);
    const [wallet] = await api.sql<{ owner_user_id: string }>('SELECT owner_user_id FROM wallets WHERE id = $1', [owner.walletId]);
    assert.equal(wallet?.owner_user_id, heir.id);
    const [demoted] = await api.sql<{ role: string }>('SELECT role FROM wallet_members WHERE wallet_id = $1 AND user_id = $2', [owner.walletId, owner.id]);
    assert.equal(demoted?.role, 'EDITOR');
  });

  it('lets only one of two concurrent transfers by the same owner win', async () => {
    const owner = await registerProbeUser(api, 'race-owner');
    const first = await registerProbeUser(api, 'race-b');
    const second = await registerProbeUser(api, 'race-c');
    await addMember(api, owner, owner.walletId, first, 'EDITOR');
    await addMember(api, owner, owner.walletId, second, 'EDITOR');

    const results = await Promise.all(
      [first, second].map((target) =>
        api.call('POST', `/wallets/${owner.walletId}/transfer-ownership`, { token: owner.token, body: { toUserId: target.id } }),
      ),
    );
    assert.deepEqual(results.map((result) => result.status).sort(), [200, 403], 'the loser has been demoted and may no longer transfer');
    const owners = await activeOwners(owner.walletId);
    assert.equal(owners.length, 1);
    assert.notEqual(owners[0], owner.id);
  });

  it('never lets the wallet lose its owner: no demoting, removing or leaving as the owner', async () => {
    const owner = await registerProbeUser(api, 'last-owner');
    const selfId = await memberIdOf(owner, owner.walletId, owner.id);

    const demote = await api.call('PATCH', `/wallets/${owner.walletId}/members/${selfId}`, { token: owner.token, body: { role: 'EDITOR' } });
    const remove = await api.call('DELETE', `/wallets/${owner.walletId}/members/${selfId}`, { token: owner.token });
    const leave = await api.call('POST', `/wallets/${owner.walletId}/leave`, { token: owner.token, body: {} });
    for (const response of [demote, remove, leave]) {
      assert.deepEqual([response.status, response.body?.error?.code], [409, 'WALLET_LAST_OWNER']);
    }
    assert.deepEqual(await activeOwners(owner.walletId), [owner.id]);
  });

  it('refuses to promote a member straight to OWNER through a role change', async () => {
    const owner = await registerProbeUser(api, 'promote');
    const editor = await registerProbeUser(api, 'promote-e');
    await addMember(api, owner, owner.walletId, editor, 'EDITOR');
    const response = await api.call('PATCH', `/wallets/${owner.walletId}/members/${await memberIdOf(owner, owner.walletId, editor.id)}`, {
      token: owner.token,
      body: { role: 'OWNER' },
    });
    assert.equal(response.status, 422);
    assert.deepEqual(await activeOwners(owner.walletId), [owner.id]);
  });

  describe('invitations', () => {
    let owner: ProbeUser;
    let invitee: ProbeUser;

    before(async () => {
      owner = await registerProbeUser(api, 'inv-owner');
      invitee = await registerProbeUser(api, 'inv-guest');
    });

    it('stores only the token hash, shows the token once, and masks the email in the public preview', async () => {
      const created = await api.call('POST', `/wallets/${owner.walletId}/invitations`, {
        token: owner.token,
        body: { email: invitee.email, role: 'VIEWER' },
      });
      assert.equal(created.status, 201);
      const token = created.body!.data.token as string;
      assert.ok(token.length > 20);

      const [stored] = await api.sql<{ token_hash: string }>('SELECT token_hash FROM wallet_invitations WHERE id = $1', [created.body!.data.id]);
      assert.ok(stored && stored.token_hash !== token && !stored.token_hash.includes(token), 'the plain token is never stored');

      const listed = await api.call('GET', `/wallets/${owner.walletId}/invitations`, { token: owner.token });
      assert.ok(listed.body!.data.every((invitation: Record<string, unknown>) => !('token' in invitation)), 'the token is shown only on create');

      const preview = await api.call('POST', '/invitations/preview', { body: { token } });
      assert.equal(preview.status, 200);
      assert.notEqual(preview.body!.data.invitedEmail, invitee.email);
      assert.ok(!String(preview.body!.data.invitedEmail).includes(invitee.email.split('@')[0]!), 'the local part is masked');

      const again = await api.call('POST', `/wallets/${owner.walletId}/invitations`, { token: owner.token, body: { email: invitee.email.toUpperCase(), role: 'EDITOR' } });
      assert.deepEqual([again.status, again.body?.error?.code], [409, 'INVITATION_ALREADY_OPEN'], 'one open invitation per address, whatever its case');

      const stranger = await registerProbeUser(api, 'inv-stranger');
      const wrongPerson = await api.call('POST', '/invitations/accept', { token: stranger.token, body: { token } });
      assert.deepEqual([wrongPerson.status, wrongPerson.body?.error?.code], [403, 'INVITATION_EMAIL_MISMATCH'], 'an invitation is to a person, not a bearer capability');

      const accepted = await api.call('POST', '/invitations/accept', { token: invitee.token, body: { token } });
      assert.equal(accepted.status, 200);
      const reused = await api.call('POST', '/invitations/accept', { token: invitee.token, body: { token } });
      assert.deepEqual([reused.status, reused.body?.error?.code], [409, 'INVITATION_ALREADY_USED']);
    });

    it('answers an expired invitation with 410', async () => {
      const guest = await registerProbeUser(api, 'inv-expired');
      const created = await api.call('POST', `/wallets/${owner.walletId}/invitations`, { token: owner.token, body: { email: guest.email, role: 'VIEWER' } });
      await api.sql("UPDATE wallet_invitations SET expires_at = now() - interval '1 minute' WHERE id = $1", [created.body!.data.id]);
      const accepted = await api.call('POST', '/invitations/accept', { token: guest.token, body: { token: created.body!.data.token } });
      assert.deepEqual([accepted.status, accepted.body?.error?.code], [410, 'INVITATION_EXPIRED']);
      const membership = await api.sql('SELECT 1 FROM wallet_members WHERE wallet_id = $1 AND user_id = $2', [owner.walletId, guest.id]);
      assert.equal(membership.length, 0);
    });

    it('lets an expired invitation be replaced without revoking it first, retiring the old token', async () => {
      const email = `probe+inv-reexpire-${randomUUID()}@example.invalid`;
      const first = await api.call('POST', `/wallets/${owner.walletId}/invitations`, { token: owner.token, body: { email, role: 'VIEWER' } });
      await api.sql("UPDATE wallet_invitations SET expires_at = now() - interval '1 minute' WHERE id = $1", [first.body!.data.id]);
      const second = await api.call('POST', `/wallets/${owner.walletId}/invitations`, { token: owner.token, body: { email: email.toUpperCase(), role: 'EDITOR' } });
      assert.equal(second.status, 201, 'an expired offer is not live, so it must not block a new one');
      const open = await api.sql('SELECT id FROM wallet_invitations WHERE wallet_id = $1 AND LOWER(invited_email) = $2 AND revoked_at IS NULL', [owner.walletId, email.toLowerCase()]);
      assert.deepEqual(open.map((row) => row.id), [second.body!.data.id]);
      const retired = await api.sql("SELECT 1 FROM audit_logs WHERE entity_id = $1 AND event = 'INVITATION_REVOKED'", [first.body!.data.id]);
      assert.equal(retired.length, 1, 'the retired offer is audited like a manual revoke');
      const again = await api.call('POST', `/wallets/${owner.walletId}/invitations`, { token: owner.token, body: { email, role: 'VIEWER' } });
      assert.deepEqual([again.status, again.body?.error?.code], [409, 'INVITATION_ALREADY_OPEN'], 'a live offer still blocks');
    });

    it('lets a revoked invitation be replaced by a new one', async () => {
      const email = `probe+inv-revoke-${randomUUID()}@example.invalid`;
      const first = await api.call('POST', `/wallets/${owner.walletId}/invitations`, { token: owner.token, body: { email, role: 'VIEWER' } });
      const revoked = await api.call('DELETE', `/wallets/${owner.walletId}/invitations/${first.body!.data.id}`, { token: owner.token });
      assert.equal(revoked.status, 204, 'revoke answers 204 No Content (API spec)');
      const second = await api.call('POST', `/wallets/${owner.walletId}/invitations`, { token: owner.token, body: { email, role: 'VIEWER' } });
      assert.equal(second.status, 201);
      const oldToken = await api.call('POST', '/invitations/preview', { body: { token: first.body!.data.token } });
      assert.equal(oldToken.status, 404, 'a revoked token no longer resolves');
    });
  });

  describe('invitations inbox (§8.6–§8.8, WAL-US-14)', () => {
    let owner: ProbeUser;

    before(async () => {
      owner = await registerProbeUser(api, 'inbox-owner');
    });

    async function invite(email: string, role = 'VIEWER'): Promise<{ id: string; token: string }> {
      const created = await api.call('POST', `/wallets/${owner.walletId}/invitations`, { token: owner.token, body: { email, role } });
      assert.equal(created.status, 201);
      return { id: created.body!.data.id, token: created.body!.data.token };
    }

    async function verified(tag: string): Promise<ProbeUser> {
      const user = await registerProbeUser(api, tag);
      await api.sql('UPDATE users SET email_verified_at = now() WHERE id = $1', [user.id]);
      return user;
    }

    it('refuses every inbox route to an unverified email, while the link still works', async () => {
      const unverified = await registerProbeUser(api, 'inbox-unverified');
      const invitation = await invite(unverified.email);

      for (const [method, path] of [
        ['GET', '/invitations'],
        ['POST', `/invitations/${invitation.id}/accept`],
        ['POST', `/invitations/${invitation.id}/decline`],
      ] as const) {
        const refused = await api.call(method, path, { token: unverified.token });
        assert.deepEqual([refused.status, refused.body?.error?.code], [403, 'INVITATION_EMAIL_UNVERIFIED'], `${method} ${path}`);
      }
      const viaLink = await api.call('POST', '/invitations/accept', { token: unverified.token, body: { token: invitation.token } });
      assert.equal(viaLink.status, 200);
    });

    it('lists only open invitations addressed to the caller, with the wallet and inviter, never a token', async () => {
      const invitee = await verified('inbox-list');
      const open = await invite(invitee.email.toUpperCase(), 'EDITOR');
      const other = await registerProbeUser(api, 'inbox-list-other');
      await invite(other.email);

      const listed = await api.call('GET', '/invitations', { token: invitee.token });
      assert.equal(listed.status, 200);
      assert.deepEqual(
        listed.body!.data.map((row: Record<string, unknown>) => [row.id, row.walletId, row.inviterName, row.role]),
        [[open.id, owner.walletId, 'probe-inbox-owner', 'EDITOR']],
      );
      assert.ok(listed.body!.data.every((row: Record<string, unknown>) => !('token' in row) && !('invitedEmail' in row)));
      assert.equal(listed.body!.meta.pagination.total, 1);

      await api.sql("UPDATE wallet_invitations SET expires_at = now() - interval '1 minute' WHERE id = $1", [open.id]);
      const afterExpiry = await api.call('GET', '/invitations', { token: invitee.token });
      assert.deepEqual(afterExpiry.body!.data, [], 'an expired invitation is no longer open');
    });

    it('accepts by id exactly as the link does, once', async () => {
      const invitee = await verified('inbox-accept');
      const invitation = await invite(invitee.email, 'EDITOR');

      const accepted = await api.call('POST', `/invitations/${invitation.id}/accept`, { token: invitee.token });
      assert.equal(accepted.status, 200);
      assert.deepEqual([accepted.body!.data.id, accepted.body!.data.role], [owner.walletId, 'EDITOR']);
      assert.deepEqual(
        await api.sql('SELECT role, status FROM wallet_members WHERE wallet_id = $1 AND user_id = $2', [owner.walletId, invitee.id]),
        [{ role: 'EDITOR', status: 'ACTIVE' }],
      );
      assert.equal(
        (await api.sql("SELECT id FROM audit_logs WHERE event = 'INVITATION_ACCEPTED' AND entity_id = $1", [invitation.id])).length,
        1,
      );

      const again = await api.call('POST', `/invitations/${invitation.id}/accept`, { token: invitee.token });
      assert.deepEqual([again.status, again.body?.error?.code], [409, 'INVITATION_ALREADY_USED']);
      const viaLink = await api.call('POST', '/invitations/accept', { token: invitee.token, body: { token: invitation.token } });
      assert.deepEqual([viaLink.status, viaLink.body?.error?.code], [409, 'INVITATION_ALREADY_USED'], 'one invitation, one use, whichever way');
    });

    it("answers someone else's invitation, or one that doesn't exist, as not found", async () => {
      const invitee = await registerProbeUser(api, 'inbox-target');
      const invitation = await invite(invitee.email);
      const stranger = await verified('inbox-stranger');

      for (const id of [invitation.id, randomUUID()]) {
        for (const action of ['accept', 'decline']) {
          const answer = await api.call('POST', `/invitations/${id}/${action}`, { token: stranger.token });
          assert.deepEqual([answer.status, answer.body?.error?.code], [404, 'INVITATION_NOT_FOUND'], `${action} ${id}`);
        }
      }
      assert.deepEqual(
        await api.sql('SELECT accepted_at, revoked_at FROM wallet_invitations WHERE id = $1', [invitation.id]),
        [{ accepted_at: null, revoked_at: null }],
      );
    });

    it('declines like a revoke: the link stops working, the owner may invite again, and it is audited', async () => {
      const invitee = await verified('inbox-decline');
      const invitation = await invite(invitee.email);

      const declined = await api.call('POST', `/invitations/${invitation.id}/decline`, { token: invitee.token });
      assert.equal(declined.status, 204);
      const viaLink = await api.call('POST', '/invitations/accept', { token: invitee.token, body: { token: invitation.token } });
      assert.deepEqual([viaLink.status, viaLink.body?.error?.code], [404, 'INVITATION_NOT_FOUND']);
      const twice = await api.call('POST', `/invitations/${invitation.id}/decline`, { token: invitee.token });
      assert.deepEqual([twice.status, twice.body?.error?.code], [404, 'INVITATION_NOT_FOUND']);

      assert.deepEqual(
        await api.sql<{ wallet_id: string; actor_id: string; actor_role: string | null }>(
          "SELECT wallet_id, actor_id, actor_role FROM audit_logs WHERE event = 'INVITATION_DECLINED' AND entity_id = $1",
          [invitation.id],
        ),
        [{ wallet_id: owner.walletId, actor_id: invitee.id, actor_role: null }],
      );
      await invite(invitee.email);
    });

    it('refuses to decline an accepted invitation, and answers an expired one with 410', async () => {
      const invitee = await verified('inbox-spent');
      const accepted = await invite(invitee.email);
      assert.equal((await api.call('POST', `/invitations/${accepted.id}/accept`, { token: invitee.token })).status, 200);
      const late = await api.call('POST', `/invitations/${accepted.id}/decline`, { token: invitee.token });
      assert.deepEqual([late.status, late.body?.error?.code], [409, 'INVITATION_ALREADY_USED']);

      const other = await verified('inbox-expired');
      const expired = await invite(other.email);
      await api.sql("UPDATE wallet_invitations SET expires_at = now() - interval '1 minute' WHERE id = $1", [expired.id]);
      for (const action of ['accept', 'decline']) {
        const answer = await api.call('POST', `/invitations/${expired.id}/${action}`, { token: other.token });
        assert.deepEqual([answer.status, answer.body?.error?.code], [410, 'INVITATION_EXPIRED'], action);
      }
    });
  });

  it('reinstates a removed member who accepts a new invitation, keeping one membership row', async () => {
    const owner = await registerProbeUser(api, 'rejoin-owner');
    const member = await registerProbeUser(api, 'rejoin-member');
    await addMember(api, owner, owner.walletId, member, 'EDITOR');
    await api.call('DELETE', `/wallets/${owner.walletId}/members/${await memberIdOf(owner, owner.walletId, member.id)}`, { token: owner.token });
    await addMember(api, owner, owner.walletId, member, 'VIEWER');

    const rows = await api.sql<{ role: string; status: string }>(
      'SELECT role, status FROM wallet_members WHERE wallet_id = $1 AND user_id = $2',
      [owner.walletId, member.id],
    );
    assert.deepEqual(rows, [{ role: 'VIEWER', status: 'ACTIVE' }]);
  });
});
