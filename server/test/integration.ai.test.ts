import { strict as assert } from 'node:assert';
import { randomUUID } from 'node:crypto';
import { after, before, describe, it } from 'node:test';

import { request as httpRequest } from 'node:http';
import type { AddressInfo } from 'node:net';

import { API_PREFIX } from '@sora/contracts';

import { LLM_PROVIDER, type LlmProvider, type LlmRequest } from '../src/ai/llm-provider.ts';
import { AppError } from '../src/common/app-error.ts';
import { addMember, createAccount, integrationSkipReason, registerProbeUser, startTestApi, type ProbeUser, type TestApi } from './support/integration.ts';

/** Letters only, so an account name inside a chat message is never read as an amount. */
const lettersOnly = () => randomUUID().replace(/[^a-f]/g, '').slice(0, 8);

/** The AI assistant proposes, the user confirms, and access is checked on both steps (AC-01). */
describe('AI assistant against a real database', { skip: integrationSkipReason() }, () => {
  let api: TestApi;
  let owner: ProbeUser;
  let viewer: ProbeUser;
  let stranger: ProbeUser;
  let conversation = '';
  let cashName = '';
  let cash = '';

  const send = (as: ProbeUser, conversationId: string, message: string, walletId = owner.walletId) =>
    api.call('POST', `/ai/conversations/${conversationId}/messages`, { token: as.token, body: { walletId, message } });
  const newConversation = async (as: ProbeUser) =>
    (await api.call('POST', '/ai/conversations', { token: as.token, body: {} })).body!.data.id as string;

  before(async () => {
    api = await startTestApi();
    owner = await registerProbeUser(api, 'ai-owner');
    viewer = await registerProbeUser(api, 'ai-viewer');
    stranger = await registerProbeUser(api, 'ai-stranger');
    await addMember(api, owner, owner.walletId, viewer, 'VIEWER');
    await createAccount(api, owner, owner.walletId, { name: `Probe ${lettersOnly()}`, initialBalance: '1000000' });
    cashName = `Probe ${lettersOnly()}`;
    cash = await createAccount(api, owner, owner.walletId, { name: cashName, initialBalance: '500000' });
    conversation = await newConversation(owner);
  });

  after(async () => {
    await api?.close();
  });

  it("drafts an expense in the named account's currency and records it only on confirm", async () => {
    const sent = await send(owner, conversation, `Spent 65k on lunch from ${cashName}`);
    assert.equal(sent.status, 201);
    const action = sent.body!.data.assistantMessage.action;
    assert.equal(action.status, 'PENDING');
    assert.deepEqual(
      [action.transaction.type, action.transaction.fromAccountId, action.transaction.amount, action.transaction.currency, action.categoryName],
      ['EXPENSE', cash, '65000.0000', 'VND', 'Food'],
    );

    const untouched = (await api.call('GET', `/accounts/${cash}`, { token: owner.token })).body!.data.balance;
    assert.equal(untouched, '500000.0000', 'a proposal alone moves no money');

    const messageId = sent.body!.data.assistantMessage.id;
    const confirmed = await api.call('POST', `/ai/conversations/${conversation}/messages/${messageId}/confirm`, { token: owner.token });
    assert.equal(confirmed.status, 200);
    assert.equal(confirmed.body!.data.action.status, 'CONFIRMED');

    const recorded = await api.call('GET', `/transactions/${confirmed.body!.data.action.transactionId}`, { token: owner.token });
    assert.deepEqual([recorded.status, recorded.body!.data.amount], [200, '65000.0000']);
    assert.equal((await api.call('GET', `/accounts/${cash}`, { token: owner.token })).body!.data.balance, '435000.0000');

    const again = await api.call('POST', `/ai/conversations/${conversation}/messages/${messageId}/confirm`, { token: owner.token });
    assert.deepEqual([again.status, again.body?.error?.code], [409, 'AI_ACTION_NOT_PENDING'], 'a second tap records nothing');
  });

  it("proposes nothing when the account is ambiguous or the currency is not the account's (BR-07)", async () => {
    const ambiguous = await send(owner, conversation, 'Spent 50k on lunch');
    assert.equal(ambiguous.body!.data.assistantMessage.action, null);
    assert.match(ambiguous.body!.data.assistantMessage.content, new RegExp(cashName));

    const foreign = await send(owner, conversation, `Spent 20 USD on coffee from ${cashName}`);
    assert.equal(foreign.body!.data.assistantMessage.action, null);
    assert.match(foreign.body!.data.assistantMessage.content, /USD/);
  });

  it('dismisses a proposal, after which it cannot be confirmed', async () => {
    const sent = await send(owner, conversation, `Paid 30k for grab from ${cashName}`);
    const messageId = sent.body!.data.assistantMessage.id;
    const dismissed = await api.call('POST', `/ai/conversations/${conversation}/messages/${messageId}/dismiss`, { token: owner.token });
    assert.deepEqual([dismissed.status, dismissed.body!.data.action.status], [200, 'DISMISSED']);

    const confirm = await api.call('POST', `/ai/conversations/${conversation}/messages/${messageId}/confirm`, { token: owner.token });
    assert.deepEqual([confirm.status, confirm.body?.error?.code], [409, 'AI_ACTION_NOT_PENDING']);
  });

  it("answers from the wallet's derived figures and lists the chat newest first", async () => {
    const answer = await send(owner, conversation, 'What is my balance?');
    assert.equal(answer.body!.data.assistantMessage.action, null);
    assert.match(answer.body!.data.assistantMessage.content, new RegExp(`${cashName}: 435,000 VND`));

    const page = await api.call('GET', `/ai/conversations/${conversation}/messages?pageSize=2`, { token: owner.token });
    assert.deepEqual(
      page.body!.data.map((message: { role: string }) => message.role),
      ['ASSISTANT', 'USER'],
    );
    assert.equal(page.body!.meta.pagination.hasMore, true);
  });

  it('lets a VIEWER ask but never be offered a transaction', async () => {
    const own = await newConversation(viewer);
    const sent = await send(viewer, own, `Spent 50k on lunch from ${cashName}`);
    assert.equal(sent.status, 201);
    assert.equal(sent.body!.data.assistantMessage.action, null);
  });

  it("answers a non-member 404, never 403, for the wallet and for someone else's conversation (AC-01)", async () => {
    const own = await newConversation(stranger);
    const wallet = await send(stranger, own, 'What is my balance?');
    assert.deepEqual([wallet.status, wallet.body?.error?.code], [404, 'WALLET_NOT_FOUND']);

    const theirs = await api.call('GET', `/ai/conversations/${conversation}/messages`, { token: stranger.token });
    assert.deepEqual([theirs.status, theirs.body?.error?.code], [404, 'AI_CONVERSATION_NOT_FOUND']);

    const listed = await api.call('GET', '/ai/conversations', { token: stranger.token });
    assert.deepEqual(listed.body!.data.map((item: { id: string }) => item.id), [own]);
  });

  it('deletes a conversation with its messages', async () => {
    const doomed = await newConversation(owner);
    await send(owner, doomed, 'hello');
    const deleted = await api.call('POST', `/ai/conversations/${doomed}/delete`, { token: owner.token });
    assert.equal(deleted.status, 200);
    const gone = await api.call('GET', `/ai/conversations/${doomed}/messages`, { token: owner.token });
    assert.deepEqual([gone.status, gone.body?.error?.code], [404, 'AI_CONVERSATION_NOT_FOUND']);
  });

  describe('when the model fails, is retried or is abandoned', () => {
    let provider: LlmProvider;
    let realReply: LlmProvider['reply'];
    const messageCount = async (conversationId: string) =>
      Number((await api.sql<{ n: string }>('SELECT count(*) AS n FROM ai_messages WHERE conversation_id = $1', [conversationId]))[0]!.n);

    before(() => {
      provider = api.app.get<LlmProvider>(LLM_PROVIDER);
      realReply = provider.reply.bind(provider);
    });
    after(() => {
      provider.reply = realReply;
    });

    it('answers 503 AI_PROVIDER_UNAVAILABLE and saves nothing, so a retry under the same key records one exchange', async () => {
      const chat = await newConversation(owner);
      const key = `probe-${randomUUID()}`;
      const body = { walletId: owner.walletId, message: 'hello' };
      provider.reply = async () => {
        throw new AppError('AI_PROVIDER_UNAVAILABLE');
      };
      const failed = await api.call('POST', `/ai/conversations/${chat}/messages`, { token: owner.token, body, headers: { 'Idempotency-Key': key } });
      assert.deepEqual([failed.status, failed.body?.error?.code], [503, 'AI_PROVIDER_UNAVAILABLE']);
      assert.equal(await messageCount(chat), 0);

      provider.reply = realReply;
      const retried = await api.call('POST', `/ai/conversations/${chat}/messages`, { token: owner.token, body, headers: { 'Idempotency-Key': key } });
      assert.equal(retried.status, 201);
      const replayed = await api.call('POST', `/ai/conversations/${chat}/messages`, { token: owner.token, body, headers: { 'Idempotency-Key': key } });
      assert.equal(replayed.body?.data?.userMessage?.id, retried.body?.data?.userMessage?.id);
      assert.equal(await messageCount(chat), 2);
    });

    it('stops the model call and saves nothing when the client disconnects before the answer', async () => {
      const chat = await newConversation(owner);
      let sawAbort!: () => void;
      const aborted = new Promise<void>((resolve) => (sawAbort = resolve));
      provider.reply = (request: LlmRequest) =>
        new Promise((_resolve, reject) => {
          request.signal?.addEventListener('abort', () => {
            sawAbort();
            reject(new AppError('AI_REQUEST_CANCELLED'));
          });
        });

      const port = (api.app.getHttpServer().address() as AddressInfo).port;
      const payload = JSON.stringify({ walletId: owner.walletId, message: 'hello' });
      const req = httpRequest({
        host: '127.0.0.1',
        port,
        method: 'POST',
        path: `${API_PREFIX}/ai/conversations/${chat}/messages`,
        headers: { 'content-type': 'application/json', 'content-length': Buffer.byteLength(payload), authorization: `Bearer ${owner.token}` },
      });
      req.on('error', () => undefined);
      req.end(payload);
      setTimeout(() => req.destroy(), 200);

      await aborted;
      provider.reply = realReply;
      assert.equal(await messageCount(chat), 0);
    });
  });
});
