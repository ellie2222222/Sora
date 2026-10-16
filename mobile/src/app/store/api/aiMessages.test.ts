import { strict as assert } from 'node:assert';
import { describe, it } from 'node:test';
import type { AiMessageResponse, SendAiMessageResponse } from '@sora/contracts';

import { prependExchange } from './aiMessages.ts';

const message = (id: string, role: 'USER' | 'ASSISTANT'): AiMessageResponse => ({
  id,
  conversationId: 'c1',
  role,
  content: id,
  action: null,
  createdAt: '2026-10-16T00:00:00.000Z',
});
const sent = (n: number): SendAiMessageResponse => ({
  conversation: { id: 'c1', walletId: 'w1', title: 't', createdAt: '', updatedAt: '' },
  userMessage: message(`u${n}`, 'USER'),
  assistantMessage: message(`a${n}`, 'ASSISTANT'),
});

describe('prependExchange', () => {
  it('puts the answer above the question at the top of a newest-first page', () => {
    const page = { items: [message('a0', 'ASSISTANT')] };
    prependExchange(page, sent(1));
    assert.deepEqual(page.items.map((item) => item.id), ['a1', 'u1', 'a0']);
  });

  it('adds a replayed exchange (a retry whose first attempt landed) only once', () => {
    const page = { items: [] as AiMessageResponse[] };
    prependExchange(page, sent(1));
    prependExchange(page, sent(1));
    assert.deepEqual(page.items.map((item) => item.id), ['a1', 'u1']);
  });

  it('leaves a chat with no loaded page alone; its first fetch brings the exchange', () => {
    assert.doesNotThrow(() => prependExchange(undefined, sent(1)));
  });
});
