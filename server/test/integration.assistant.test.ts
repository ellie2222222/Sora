import { strict as assert } from 'node:assert';
import { randomUUID } from 'node:crypto';
import { after, before, describe, it } from 'node:test';

import { addMember, categoryOf, createAccount, integrationSkipReason, nowIso, registerProbeUser, startTestApi, type ProbeUser, type TestApi } from './support/integration.ts';

/** Letters only, so an account name inside a chat message is never read as an amount. */
const lettersOnly = () => randomUUID().replace(/[^a-f]/g, '').slice(0, 8);

/** §17 AI assistant on the default mock provider: write re-checks on confirm, BR-06/07 in answers, deletion. */
describe('AI assistant writes and answers against a real database', { skip: integrationSkipReason() }, () => {
  let api: TestApi;

  const newConversation = async (as: ProbeUser) =>
    (await api.call('POST', '/ai/conversations', { token: as.token, body: {} })).body!.data.id as string;
  const send = (as: ProbeUser, conversationId: string, walletId: string, message: string) =>
    api.call('POST', `/ai/conversations/${conversationId}/messages`, { token: as.token, body: { walletId, message } });
  const confirm = (as: ProbeUser, conversationId: string, messageId: string) =>
    api.call('POST', `/ai/conversations/${conversationId}/messages/${messageId}/confirm`, { token: as.token });
  const transactionsOn = async (accountId: string) =>
    (
      await api.sql<{ count: string }>('SELECT count(*)::text AS count FROM transactions WHERE from_account_id = $1 OR to_account_id = $1', [accountId])
    )[0]!.count;

  before(async () => {
    api = await startTestApi();
  });

  after(async () => {
    await api?.close();
  });

  it('AI-US-02: proposes nothing on an archived wallet, and a proposal made before archiving cannot be confirmed', async () => {
    const owner = await registerProbeUser(api, 'ai-archived');
    const wallet = (await api.call('POST', '/wallets', { token: owner.token, body: { name: `probe-${randomUUID()}` } })).body!.data.id as string;
    const cashName = `Probe ${lettersOnly()}`;
    const cash = await createAccount(api, owner, wallet, { name: cashName, initialBalance: '500000' });
    // Only the registration wallet is seeded with starter categories.
    const category = await api.call('POST', '/categories', { token: owner.token, body: { walletId: wallet, name: 'Food', type: 'EXPENSE' } });
    assert.equal(category.status, 201);
    const conversation = await newConversation(owner);

    const early = await send(owner, conversation, wallet, `Spent 40k on lunch from ${cashName}`);
    assert.equal(early.body!.data.assistantMessage.action.status, 'PENDING');

    assert.equal((await api.call('DELETE', `/wallets/${wallet}`, { token: owner.token })).status, 204);

    const sent = await send(owner, conversation, wallet, `Spent 50k on lunch from ${cashName}`);
    assert.equal(sent.status, 201);
    assert.equal(sent.body!.data.assistantMessage.action, null);

    const late = await confirm(owner, conversation, early.body!.data.assistantMessage.id);
    assert.deepEqual([late.status, late.body?.error?.code], [409, 'WALLET_ARCHIVED']);
    assert.equal(await transactionsOn(cash), '0', 'nothing recorded');
  });

  it('AI-US-02: re-checks the role on confirm, so a caller lowered to VIEWER gets 403 and nothing is recorded', async () => {
    const owner = await registerProbeUser(api, 'ai-demote-owner');
    const editor = await registerProbeUser(api, 'ai-demote-editor');
    await addMember(api, owner, owner.walletId, editor, 'EDITOR');
    const cashName = `Probe ${lettersOnly()}`;
    const cash = await createAccount(api, owner, owner.walletId, { name: cashName, initialBalance: '500000' });
    const conversation = await newConversation(editor);

    const sent = await send(editor, conversation, owner.walletId, `Spent 65k on lunch from ${cashName}`);
    assert.equal(sent.body!.data.assistantMessage.action.status, 'PENDING');

    const members = await api.call('GET', `/wallets/${owner.walletId}/members`, { token: owner.token });
    const memberId = (members.body!.data as { id: string; userId: string }[]).find((member) => member.userId === editor.id)!.id;
    const lowered = await api.call('PATCH', `/wallets/${owner.walletId}/members/${memberId}`, { token: owner.token, body: { role: 'VIEWER' } });
    assert.equal(lowered.status, 200);

    const confirmed = await confirm(editor, conversation, sent.body!.data.assistantMessage.id);
    assert.deepEqual([confirmed.status, confirmed.body?.error?.code], [403, 'FORBIDDEN']);
    assert.equal(await transactionsOn(cash), '0');
    assert.equal((await api.call('GET', `/accounts/${cash}`, { token: owner.token })).body!.data.balance, '500000.0000');
  });

  it("AI-US-01: answers spending per currency, never summed, and leaves the month's transfer out of it (BR-06/07)", async () => {
    const owner = await registerProbeUser(api, 'ai-spending');
    const bank = await createAccount(api, owner, owner.walletId, { name: `Probe ${lettersOnly()}`, initialBalance: '10000000' });
    const cash = await createAccount(api, owner, owner.walletId, { name: `Probe ${lettersOnly()}` });
    const usd = await createAccount(api, owner, owner.walletId, { name: `Probe ${lettersOnly()}`, currency: 'USD', initialBalance: '100' });
    const food = await categoryOf(api, owner, owner.walletId, 'EXPENSE');
    // The assistant reads the current month's figures, so these are dated now rather than in a fixed period.
    const post = (body: Record<string, unknown>) =>
      api.call('POST', '/transactions', { token: owner.token, body: { currency: 'VND', transactionDate: nowIso(), ...body } });
    assert.equal((await post({ type: 'EXPENSE', fromAccountId: bank, categoryId: food, amount: '150000' })).status, 201);
    assert.equal((await post({ type: 'EXPENSE', fromAccountId: usd, categoryId: food, amount: '2.5', currency: 'USD' })).status, 201);
    assert.equal((await post({ type: 'TRANSFER', fromAccountId: bank, toAccountId: cash, amount: '2000000' })).status, 201);

    const conversation = await newConversation(owner);
    const answer = await send(owner, conversation, owner.walletId, 'How much did I spend this month?');
    assert.equal(answer.status, 201);
    assert.equal(answer.body!.data.assistantMessage.action, null);
    const content = answer.body!.data.assistantMessage.content as string;
    assert.match(content, /(^|[^\d,.])150,000 VND/, 'the VND expense alone');
    assert.match(content, /(^|[^\d,.])2\.5 USD/, 'the USD expense on its own');
    assert.doesNotMatch(content, /2,150,000/, 'the transfer is not spending');
    assert.doesNotMatch(content, /150,002\.5|152\.5/, 'no cross-currency sum');
  });

  it('AI-US-03: deleting a conversation removes its messages but keeps the transaction confirmed from it', async () => {
    const owner = await registerProbeUser(api, 'ai-delete');
    const cashName = `Probe ${lettersOnly()}`;
    const cash = await createAccount(api, owner, owner.walletId, { name: cashName, initialBalance: '500000' });
    const conversation = await newConversation(owner);

    const sent = await send(owner, conversation, owner.walletId, `Spent 65k on lunch from ${cashName}`);
    const confirmed = await confirm(owner, conversation, sent.body!.data.assistantMessage.id);
    assert.equal(confirmed.status, 200);
    const transactionId = confirmed.body!.data.action.transactionId as string;

    const deleted = await api.call('POST', `/ai/conversations/${conversation}/delete`, { token: owner.token });
    assert.deepEqual([deleted.status, deleted.body!.data.id], [200, conversation]);
    const gone = await api.call('GET', `/ai/conversations/${conversation}/messages`, { token: owner.token });
    assert.deepEqual([gone.status, gone.body?.error?.code], [404, 'AI_CONVERSATION_NOT_FOUND']);
    const [row] = await api.sql<{ count: string }>('SELECT count(*)::text AS count FROM ai_messages WHERE conversation_id = $1', [conversation]);
    assert.equal(row?.count, '0');

    const kept = await api.call('GET', `/transactions/${transactionId}`, { token: owner.token });
    assert.deepEqual([kept.status, kept.body!.data.status, kept.body!.data.amount], [200, 'COMPLETED', '65000.0000']);
    assert.equal((await api.call('GET', `/accounts/${cash}`, { token: owner.token })).body!.data.balance, '435000.0000');
  });
});
