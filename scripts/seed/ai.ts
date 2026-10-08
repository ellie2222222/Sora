// Phase 7: one AI conversation through the server's MockLlmProvider (keyword rules, no model). A question,
// then three statements with an amount: one proposal confirmed, one dismissed, one left pending.

import { dayOfInstant, parseMoney, type AiConversationResponse, type AiMessageResponse, type SendAiMessageResponse, type TransactionResponse } from '@sora/contracts';

import type { SeedApi } from './client.ts';
import { applyRow, type Ledger, type Row } from './ledger.ts';
import { WALLETS } from './personas.ts';
import type { Seeder } from './post.ts';

export async function seedAiConversation(api: SeedApi, seeder: Seeder, ledger: Ledger): Promise<Row> {
  const session = seeder.session('an');
  const walletId = seeder.ids.wallets.an!;
  const conversation = await api.call<AiConversationResponse>('POST', '/ai/conversations', { session, body: { walletId, title: 'This month' }, expect: [201] });
  // An account must be named: An's wallet has several, and the assistant asks "which account?" otherwise.
  const send = async (message: string): Promise<AiMessageResponse> =>
    (await api.call<SendAiMessageResponse>('POST', `/ai/conversations/${conversation.id}/messages`, { session, body: { walletId, message, locale: 'en' }, expect: [201] })).assistantMessage;

  const answer = await send('How much did I spend this month?');
  if (answer.action !== null) throw new Error('A question got a proposal instead of an answer');
  const proposals = [];
  for (const statement of ['Spent 45k on coffee from MoMo', 'Paid 120k for lunch from MoMo', 'Bought groceries 350k from Vietcombank']) {
    const reply = await send(statement);
    if (reply.action?.status !== 'PENDING') throw new Error(`"${statement}" got no proposal: ${reply.content}`);
    proposals.push(reply);
  }
  const [toConfirm, toDismiss, toLeave] = proposals as [AiMessageResponse, AiMessageResponse, AiMessageResponse];
  const confirmed = await api.call<AiMessageResponse>('POST', `/ai/conversations/${conversation.id}/messages/${toConfirm.id}/confirm`, { session, expect: [200] });
  await api.call('POST', `/ai/conversations/${conversation.id}/messages/${toDismiss.id}/dismiss`, { session, expect: [200] });

  // The confirmed draft is dated at the run instant, so it joins the ledger as read back, before verify.
  const transaction = await api.call<TransactionResponse>('GET', `/transactions/${confirmed.action!.transactionId}`, { session });
  const categoryKey = Object.entries(seeder.ids.categories.an!).find(([, id]) => id === transaction.category?.id)?.[0] ?? null;
  const zone = WALLETS.an.timeZone;
  const local = new Intl.DateTimeFormat('en-GB', { timeZone: zone, hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23' }).format(new Date(transaction.transactionDate));
  const row: Row = {
    id: 'ai-confirmed',
    seq: Number.MAX_SAFE_INTEGER,
    by: 'an',
    type: 'EXPENSE',
    status: 'COMPLETED',
    from: 'momo',
    to: null,
    amount: parseMoney(transaction.amount),
    category: categoryKey,
    goal: null,
    day: dayOfInstant(transaction.transactionDate, zone),
    time: local,
    description: transaction.description,
    reference: null,
    tag: 'aiConfirmed',
    instant: new Date(transaction.transactionDate).toISOString(),
  };
  ledger.rows.push(row);
  applyRow(ledger.balances, row);
  seeder.ids.transactions[row.id] = transaction.id;
  seeder.ids.ai = { conversationId: conversation.id, confirmed: toConfirm.id, dismissed: toDismiss.id, pending: toLeave.id, transactionId: transaction.id };
  return row;
}
