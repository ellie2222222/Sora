import { strict as assert } from 'node:assert';
import { describe, it } from 'node:test';
import {
  AccountType,
  CategoryType,
  TransactionType,
  WalletRole,
  WalletStatus,
  type DashboardResponse,
} from '@sora/contracts';

import {
  buildAiContext,
  cleanJsonText,
  executeWithGemini,
  parseModelJson,
  rawGeminiResponseSchema,
  tidyContent,
  UserIntent,
} from '../src/ai/intent-context.ts';
import {
  detectUserIntent,
  executeIntent,
  MockLlmProvider,
} from '../src/ai/mock-llm.provider.ts';
import { AppError } from '../src/common/app-error.ts';
import { GeminiLlmProvider } from '../src/ai/gemini-llm.provider.ts';
import type { AiToolbox, LlmRequest, WalletSnapshot } from '../src/ai/llm-provider.ts';

function createMockToolbox(overrides?: {
  snapshot?: Partial<WalletSnapshot>;
  summary?: Partial<DashboardResponse>;
}): AiToolbox {
  const snapshot: WalletSnapshot = {
    walletId: '11111111-1111-1111-1111-111111111111',
    walletName: 'Personal Wallet',
    role: WalletRole.OWNER,
    status: WalletStatus.ACTIVE,
    accounts: [
      {
        id: '22222222-2222-2222-2222-222222222222',
        name: 'Cash',
        type: AccountType.CASH,
        currency: 'VND',
        balance: '500000.0000',
      },
    ],
    categories: [
      {
        id: '33333333-3333-3333-3333-333333333333',
        name: 'Food & Dining',
        type: CategoryType.EXPENSE,
      },
      {
        id: '44444444-4444-4444-4444-444444444444',
        name: 'Salary',
        type: CategoryType.INCOME,
      },
    ],
    ...overrides?.snapshot,
  };

  const summary = {
    period: { dateFrom: '2026-10-01', dateTo: '2026-10-31', timeZone: 'Asia/Ho_Chi_Minh' },
    income: [{ amount: '10000000.0000', currency: 'VND' }],
    expense: [{ amount: '2500000.0000', currency: 'VND' }],
    netSavings: [{ amount: '7500000.0000', currency: 'VND' }],
    spendingByCategory: [{ categoryId: '33333333-3333-3333-3333-333333333333', categoryName: 'Food & Dining', amount: '2500000.0000', percentage: 100 }],
    activeBudgets: [
      {
        id: '55555555-5555-5555-5555-555555555555',
        name: 'Monthly Dining',
        categoryId: '33333333-3333-3333-3333-333333333333',
        goalId: null,
        periodType: 'MONTHLY',
        amount: '3000000.0000',
        currency: 'VND',
        spent: '2500000.0000',
        usagePercentage: 83,
        isOverBudget: false,
        startDate: '2026-10-01',
        endDate: '2026-10-31',
      },
    ],
    activeGoals: [
      {
        id: '66666666-6666-6666-6666-666666666666',
        name: 'Emergency Fund',
        targetAmount: '50000000.0000',
        currentAmount: '20000000.0000',
        currency: 'VND',
        progressPercentage: 40,
        status: 'ACTIVE',
        targetDate: null,
      },
    ],
    ...overrides?.summary,
  } as unknown as DashboardResponse;

  return {
    walletSnapshot: async () => snapshot,
    monthSummary: async () => summary,
  };
}

describe('Intent Detection Engine (detectUserIntent)', () => {
  it('detects transaction recording intent in English and extracts scaled amount', () => {
    const result = detectUserIntent({
      message: 'Spent 50k on lunch from Cash',
      locale: 'en',
    });

    assert.equal(result.intent, UserIntent.RECORD_TRANSACTION);
    assert.equal(result.confidence, 0.95);
    assert.ok(result.entities.transaction);
    assert.equal(result.entities.transaction?.type, TransactionType.EXPENSE);
    assert.equal(result.entities.transaction?.amount, 500000000n);
    assert.equal(result.entities.transaction?.formattedAmount, '50000.0000');
  });

  it('detects income transaction recording intent in Vietnamese', () => {
    const result = detectUserIntent({
      message: 'Nhận 10tr lương vào Cash',
      locale: 'vi',
    });

    assert.equal(result.intent, UserIntent.RECORD_TRANSACTION);
    assert.ok(result.entities.transaction);
    assert.equal(result.entities.transaction?.type, TransactionType.INCOME);
    assert.equal(result.entities.transaction?.amount, 100000000000n);
    assert.equal(result.entities.transaction?.formattedAmount, '10000000.0000');
  });

  it('treats amount in a question as spending inquiry instead of a record command', () => {
    const result = detectUserIntent({
      message: 'How much did I spend in 2026?',
      locale: 'en',
    });

    assert.equal(result.intent, UserIntent.QUERY_SPENDING);
  });

  it('detects balance queries in English and Vietnamese', () => {
    const en = detectUserIntent({ message: 'What is my current balance?', locale: 'en' });
    assert.equal(en.intent, UserIntent.QUERY_BALANCES);

    const vi = detectUserIntent({ message: 'Số dư của tôi còn bao nhiêu?', locale: 'vi' });
    assert.equal(vi.intent, UserIntent.QUERY_BALANCES);
  });

  it('detects budget queries in English and Vietnamese', () => {
    const en = detectUserIntent({ message: 'Check my monthly budgets', locale: 'en' });
    assert.equal(en.intent, UserIntent.QUERY_BUDGETS);

    const vi = detectUserIntent({ message: 'Tình hình ngân sách thế nào?', locale: 'vi' });
    assert.equal(vi.intent, UserIntent.QUERY_BUDGETS);
  });

  it('detects savings goals queries in English and Vietnamese', () => {
    const en = detectUserIntent({ message: 'Show me my saving goals', locale: 'en' });
    assert.equal(en.intent, UserIntent.QUERY_GOALS);

    const vi = detectUserIntent({ message: 'Tiến độ mục tiêu tiết kiệm thế nào?', locale: 'vi' });
    assert.equal(vi.intent, UserIntent.QUERY_GOALS);
  });

  it('falls back to general assistance for unclassified greetings or queries', () => {
    const result = detectUserIntent({ message: 'Hello! How are you?', locale: 'en' });
    assert.equal(result.intent, UserIntent.GENERAL_ASSISTANCE);
  });
});

describe('Intent Execution Engine (executeIntent)', () => {
  it('creates an accepted transaction proposal when user has write permissions', async () => {
    const message = 'Spent 50k on lunch from Cash';
    const detected = detectUserIntent({ message, locale: 'en' });
    const toolbox = createMockToolbox();
    const request: LlmRequest = {
      message,
      locale: 'en',
      history: [],
      toolbox,
      now: new Date('2026-10-12T00:00:00Z'),
    };

    const reply = await executeIntent(detected, request);

    assert.ok(reply.proposal);
    assert.equal(reply.proposal?.accountName, 'Cash');
    assert.equal(reply.proposal?.categoryName, 'Food & Dining');
    assert.equal(reply.proposal?.transaction.amount, '50000.0000');
    assert.equal(reply.proposal?.transaction.currency, 'VND');
    assert.equal(reply.proposal?.transaction.type, 'EXPENSE');
  });

  it('refuses to propose transactions when caller has viewer role', async () => {
    const message = 'Spent 50k on lunch from Cash';
    const detected = detectUserIntent({ message, locale: 'en' });
    const toolbox = createMockToolbox({
      snapshot: { role: WalletRole.VIEWER },
    });
    const request: LlmRequest = {
      message,
      locale: 'en',
      history: [],
      toolbox,
      now: new Date('2026-10-12T00:00:00Z'),
    };

    const reply = await executeIntent(detected, request);

    assert.equal(reply.proposal, undefined);
    assert.ok(reply.content.includes('view-only'));
  });

  it('fetches the wallet and the month at most once per reply', async () => {
    let snapshots = 0;
    let summaries = 0;
    const toolbox = createMockToolbox();
    const counted: AiToolbox = {
      walletSnapshot: () => (snapshots++, toolbox.walletSnapshot()),
      monthSummary: () => (summaries++, toolbox.monthSummary()),
    };
    for (const message of ['Spent 50k on lunch from Cash', 'What is my balance?', 'How much did I spend?', 'How are my budgets?', 'My goals?', 'hi']) {
      snapshots = 0;
      summaries = 0;
      await new MockLlmProvider().reply({ message, locale: 'en', history: [], toolbox: counted, now: new Date('2026-10-12T00:00:00Z') });
      assert.ok(snapshots <= 1 && summaries <= 1, `${message}: ${snapshots} snapshots, ${summaries} summaries`);
    }
  });

  it('formats active budget lines cleanly in Vietnamese', async () => {
    const message = 'Ngân sách của tôi thế nào?';
    const detected = detectUserIntent({ message, locale: 'vi' });
    const toolbox = createMockToolbox();
    const request: LlmRequest = {
      message,
      locale: 'vi',
      history: [],
      toolbox,
      now: new Date('2026-10-12T00:00:00Z'),
    };

    const reply = await executeIntent(detected, request);

    assert.ok(reply.content.includes('Ngân sách đang hoạt động:'));
    assert.ok(reply.content.includes('Monthly Dining'));
    assert.ok(reply.content.includes('83%'));
  });
});

describe('Gemini Response Cleaning & Schema Validation', () => {
  it('strips markdown code fences from json response', () => {
    const markdown = '```json\n{"content": "Hello Sora!"}\n```';
    assert.equal(cleanJsonText(markdown), '{"content": "Hello Sora!"}');

    const bareFence = '```\n{"content": "No language tag"}\n```';
    assert.equal(cleanJsonText(bareFence), '{"content": "No language tag"}');

    const clean = '{"content": "Already clean"}';
    assert.equal(cleanJsonText(clean), '{"content": "Already clean"}');
  });

  it('validates response against rawGeminiResponseSchema with Zod', () => {
    const valid = {
      content: 'I have logged your coffee.',
      proposal: {
        type: TransactionType.EXPENSE,
        accountId: '22222222-2222-2222-2222-222222222222',
        categoryId: '33333333-3333-3333-3333-333333333333',
        amount: '45000.0000',
        currency: 'VND',
        description: 'coffee',
        transactionDate: '2026-10-15T00:00:00Z',
      },
    };

    const parsed = rawGeminiResponseSchema.safeParse(valid);
    assert.equal(parsed.success, true);

    const invalidProposal = {
      content: 'Missing amount',
      proposal: {
        type: 'INVALID_TYPE',
        accountId: 'not-a-uuid',
      },
    };
    const invalidParsed = rawGeminiResponseSchema.safeParse(invalidProposal);
    assert.equal(invalidParsed.success, false);
  });
});

type FakeStep = 'ok' | 'hang' | 'network' | number;

/** A Gemini stand-in answering each call with the next scripted step for its model. */
function scriptedGemini(script: Record<string, FakeStep[]>, calls: string[], okText = JSON.stringify({ intent: 'GENERAL_ASSISTANCE', content: 'Hello.' })) {
  return (async (input: unknown, init?: RequestInit) => {
    const model = /models\/([^:]+):/.exec(String(input))![1]!;
    calls.push(model);
    const step = script[model]?.shift() ?? 'ok';
    if (step === 'hang') {
      return new Promise<Response>((_resolve, reject) => {
        init?.signal?.addEventListener('abort', () => reject(init.signal!.reason), { once: true });
      });
    }
    if (step === 'network') throw new TypeError('fetch failed');
    if (step === 'ok') {
      return new Response(JSON.stringify({ candidates: [{ content: { parts: [{ text: okText }] } }] }), { status: 200 });
    }
    return new Response(JSON.stringify({ error: { code: step } }), {
      status: step,
      headers: step === 503 ? { 'Retry-After': '1' } : {},
    });
  }) as typeof fetch;
}

async function runScripted(
  script: Record<string, FakeStep[]>,
  options: { signal?: AbortSignal; deadline?: number } = {},
) {
  const calls: string[] = [];
  const sleeps: number[] = [];
  const request: LlmRequest = {
    message: 'Hi',
    locale: 'en',
    history: [],
    toolbox: createMockToolbox(),
    now: new Date('2026-10-12T03:00:00Z'),
    ...options,
  };
  const originalFetch = globalThis.fetch;
  globalThis.fetch = scriptedGemini(script, calls);
  try {
    const reply = await executeWithGemini(await buildAiContext(request), request, {
      apiKey: 'test-key',
      model: 'primary-model',
      fallbackModel: 'fallback-model',
      attemptTimeoutMs: { primary: 50, fallback: 50 },
      sleep: async (ms) => {
        sleeps.push(ms);
      },
    });
    return { reply, error: undefined, calls, sleeps };
  } catch (error) {
    return { reply: undefined, error, calls, sleeps };
  } finally {
    globalThis.fetch = originalFetch;
  }
}

function errorCode(error: unknown): string | undefined {
  return error instanceof AppError ? error.code : undefined;
}

describe('Gemini Execution Fallback & Model Failover (executeWithGemini)', () => {
  it('answers from the primary model on its first attempt', async () => {
    const { reply, calls, sleeps } = await runScripted({});
    assert.equal(reply?.content, 'Hello.');
    assert.deepEqual(calls, ['primary-model']);
    assert.deepEqual(sleeps, []);
  });

  it('retries a 503 once, honouring Retry-After, then answers from the fallback model', async () => {
    const { reply, calls, sleeps } = await runScripted({ 'primary-model': [503, 503] });
    assert.equal(reply?.content, 'Hello.');
    assert.deepEqual(calls, ['primary-model', 'primary-model', 'fallback-model']);
    assert.equal(sleeps.length, 1);
    assert.ok(sleeps[0]! >= 1000, `waited ${sleeps[0]}ms, Retry-After asked for 1000`);
  });

  it('moves to the fallback model at once when the primary times out', async () => {
    const { reply, calls, sleeps } = await runScripted({ 'primary-model': ['hang'] });
    assert.equal(reply?.content, 'Hello.');
    assert.deepEqual(calls, ['primary-model', 'fallback-model']);
    assert.deepEqual(sleeps, []);
  });

  it('fails over immediately from a rate-limited primary (429)', async () => {
    const { reply, calls } = await runScripted({ 'primary-model': [429] });
    assert.equal(reply?.content, 'Hello.');
    assert.deepEqual(calls, ['primary-model', 'fallback-model']);
  });

  it('answers AI_PROVIDER_UNAVAILABLE, never an invented reply, when every model fails', async () => {
    const { reply, error, calls } = await runScripted({ 'primary-model': [503, 503], 'fallback-model': ['network', 'network'] });
    assert.equal(reply, undefined);
    assert.equal(errorCode(error), 'AI_PROVIDER_UNAVAILABLE');
    assert.equal(calls.length, 4);
  });

  it('answers AI_PROVIDER_BUSY when every model is rate limited', async () => {
    const { error, calls } = await runScripted({ 'primary-model': [429], 'fallback-model': [429] });
    assert.equal(errorCode(error), 'AI_PROVIDER_BUSY');
    assert.deepEqual(calls, ['primary-model', 'fallback-model']);
  });

  it('answers AI_PROVIDER_TIMEOUT when every model times out', async () => {
    const { error, calls } = await runScripted({ 'primary-model': ['hang'], 'fallback-model': ['hang'] });
    assert.equal(errorCode(error), 'AI_PROVIDER_TIMEOUT');
    assert.deepEqual(calls, ['primary-model', 'fallback-model']);
  });

  it('never retries a 401 or 403: one call, then AI_PROVIDER_UNAVAILABLE', async () => {
    for (const status of [401, 403]) {
      const { error, calls } = await runScripted({ 'primary-model': [status] });
      assert.equal(errorCode(error), 'AI_PROVIDER_UNAVAILABLE');
      assert.deepEqual(calls, ['primary-model']);
    }
  });

  it('gives a 400 to the fallback model once, never retrying the same model', async () => {
    const { reply, calls } = await runScripted({ 'primary-model': [400] });
    assert.equal(reply?.content, 'Hello.');
    assert.deepEqual(calls, ['primary-model', 'fallback-model']);
  });

  it('stops at a safety block instead of retrying a prompt every model will refuse', async () => {
    const calls: string[] = [];
    const request: LlmRequest = { message: 'Hi', locale: 'en', history: [], toolbox: createMockToolbox(), now: new Date() };
    const originalFetch = globalThis.fetch;
    globalThis.fetch = (async (input: unknown) => {
      calls.push(String(input));
      return new Response(JSON.stringify({ promptFeedback: { blockReason: 'SAFETY' }, candidates: [] }), { status: 200 });
    }) as typeof fetch;
    try {
      await assert.rejects(
        executeWithGemini(await buildAiContext(request), request, { apiKey: 'k', model: 'p', fallbackModel: 'f', sleep: async () => undefined }),
        (error) => errorCode(error) === 'AI_PROVIDER_UNAVAILABLE',
      );
      assert.equal(calls.length, 1);
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  it('starts no attempt once the reply budget is spent', async () => {
    const { error, calls } = await runScripted({}, { deadline: Date.now() + 1_000 });
    assert.equal(errorCode(error), 'AI_PROVIDER_TIMEOUT');
    assert.deepEqual(calls, []);
  });

  it('stops at once with AI_REQUEST_CANCELLED when the client disconnects mid-call', async () => {
    const disconnected = new AbortController();
    setTimeout(() => disconnected.abort(), 10);
    const { error, calls } = await runScripted({ 'primary-model': ['hang'] }, { signal: disconnected.signal });
    assert.equal(errorCode(error), 'AI_REQUEST_CANCELLED');
    assert.deepEqual(calls, ['primary-model']);
  });

  it('GeminiLlmProvider surfaces the failure instead of the keyword assistant', async () => {
    const request: LlmRequest = { message: 'Who are you?', locale: 'en', history: [], toolbox: createMockToolbox(), now: new Date() };
    const originalFetch = globalThis.fetch;
    globalThis.fetch = scriptedGemini({ 'm1': [400] }, []);
    try {
      await assert.rejects(new GeminiLlmProvider('test-key', 'm1', 'm1').reply(request), (error) => errorCode(error) === 'AI_PROVIDER_UNAVAILABLE');
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  it('buildAiContext equips Gemini with full wallet context and AI intent detection instructions', async () => {
    const toolbox = createMockToolbox();
    const request: LlmRequest = {
      message: 'Can I afford dinner tonight?', // Complex query not matching any static word arrays!
      locale: 'en',
      history: [],
      toolbox,
      now: new Date('2026-10-12T00:00:00Z'),
    };

    const context = await buildAiContext(request);

    // Context contains both accounts/categories AND financial summary data
    assert.ok(context.walletContext);
    assert.equal(context.walletContext.accounts.length, 1);
    assert.equal(context.walletContext.categories.length, 2);
    assert.ok(context.financialData);
    assert.ok(context.financialData.monthSpending);
    assert.ok(context.financialData.budgets);
    assert.ok(context.financialData.goals);

    // System instructions instruct the AI to detect intent across languages
    assert.ok(context.systemInstructions.includes('INTENT DETECTION & HANDLING:'));
    assert.ok(context.systemInstructions.includes('RECORD_TRANSACTION'));
    assert.ok(context.systemInstructions.includes('QUERY_BALANCES'));
    assert.ok(context.systemInstructions.includes('QUERY_SPENDING'));
  });

  it('validates response with AI-detected intent field', () => {
    const raw = JSON.stringify({
      intent: 'RECORD_TRANSACTION',
      content: 'I drafted a 50,000 VND expense for lunch.',
      proposal: {
        type: 'EXPENSE',
        accountId: '22222222-2222-2222-2222-222222222222',
        categoryId: '33333333-3333-3333-3333-333333333333',
        amount: '50000.0000',
        currency: 'VND',
        description: 'Lunch',
        transactionDate: '2026-10-12T00:00:00.000Z',
      },
    });

    const parsed = rawGeminiResponseSchema.safeParse(JSON.parse(raw));
    assert.ok(parsed.success);
    assert.equal(parsed.data.intent, 'RECORD_TRANSACTION');
    assert.ok(parsed.data.proposal);
  });
});

function geminiReturning(text: string, seen: { url: string; init?: RequestInit }[] = []): typeof fetch {
  return (async (input: unknown, init?: RequestInit) => {
    seen.push({ url: String(input), init });
    return new Response(JSON.stringify({ candidates: [{ content: { parts: [{ text }] } }] }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  }) as typeof fetch;
}

async function askGemini(message: string, modelText: string, seen?: { url: string; init?: RequestInit }[]) {
  const request: LlmRequest = {
    message,
    locale: 'en',
    history: [],
    toolbox: createMockToolbox(),
    now: new Date('2026-10-12T03:00:00Z'),
  };
  const originalFetch = globalThis.fetch;
  globalThis.fetch = geminiReturning(modelText, seen);
  try {
    return await executeWithGemini(await buildAiContext(request), request, { apiKey: 'test-key', model: 'gemini-3.8-flash', fallbackModel: 'gemini-3.1-flash-lite' });
  } finally {
    globalThis.fetch = originalFetch;
  }
}

describe('Gemini output that is escaped, wrapped or Markdown', () => {
  it('parses an object JSON-encoded a second time', () => {
    const twice = JSON.stringify(JSON.stringify({ content: 'Cash holds "500,000 VND".' }));
    assert.deepEqual(parseModelJson(twice), { content: 'Cash holds "500,000 VND".' });
  });

  it('parses an object with a sentence around it', () => {
    assert.deepEqual(parseModelJson('Here you go: {"content": "Hi"} Done.'), { content: 'Hi' });
  });

  it('undoes leaked \\" and \n escapes and drops Markdown', () => {
    const raw = '\\"Balances\\":\n## Accounts\n- **Cash**: 500,000 VND\n* `Bank`: 1,000 USD\n\n\n\nSee [app](https://x.invalid).';
    assert.equal(tidyContent(raw), '"Balances":\nAccounts\n• Cash: 500,000 VND\n• Bank: 1,000 USD\n\nSee app.');
  });

  it('removes quotes wrapping the whole reply', () => {
    assert.equal(tidyContent('"Your Cash balance is 500,000 VND."'), 'Your Cash balance is 500,000 VND.');
  });

  it('returns tidy content from a double-encoded reply', async () => {
    const modelText = JSON.stringify(JSON.stringify({ intent: 'QUERY_BALANCES', content: '\\"Cash\\": 500,000 VND' }));
    const reply = await askGemini('How much cash do I have?', modelText);
    assert.equal(reply.content, '"Cash": 500,000 VND');
  });
});

describe('Gemini request and proposal handling', () => {
  it('asks for application/json and sends the key in a header, not the URL', async () => {
    const seen: { url: string; init?: RequestInit }[] = [];
    await askGemini('Hi', JSON.stringify({ intent: 'GENERAL_ASSISTANCE', content: 'Hello.' }), seen);
    assert.equal(seen.length, 1);
    assert.ok(!seen[0]!.url.includes('key='));
    const headers = seen[0]!.init!.headers as Record<string, string>;
    assert.equal(headers['Content-Type'], 'application/json');
    assert.equal(headers.Accept, 'application/json');
    assert.equal(headers['x-goog-api-key'], 'test-key');
    const body = JSON.parse(String(seen[0]!.init!.body));
    assert.equal(body.generationConfig.responseMimeType, 'application/json');
  });

  it('gives the model today in the wallet zone and amounts as the reader writes them', async () => {
    const request: LlmRequest = {
      message: 'Hi',
      locale: 'en',
      history: [],
      toolbox: createMockToolbox(),
      now: new Date('2026-10-12T20:00:00Z'),
    };
    const { systemInstructions } = await buildAiContext(request);
    assert.ok(systemInstructions.includes('today in the wallet\'s time zone (Asia/Ho_Chi_Minh) is 2026-10-13'));
    assert.ok(systemInstructions.includes('"balance":"500,000 VND"'));
    assert.ok(systemInstructions.includes('"spent":"2,500,000 VND","limit":"3,000,000 VND"'));
  });

  it('accepts "50,000" and a named day, recorded on that wallet day', async () => {
    const modelText = JSON.stringify({
      intent: 'RECORD_TRANSACTION',
      content: 'Draft: 50,000 VND lunch from Cash. Confirm it?',
      proposal: {
        type: 'EXPENSE',
        accountId: '22222222-2222-2222-2222-222222222222',
        categoryId: '33333333-3333-3333-3333-333333333333',
        amount: '50,000',
        currency: 'VND',
        description: 'Lunch at \\"Pho 24\\"',
        transactionDate: '2026-10-11',
      },
    });
    const reply = await askGemini('Spent 50k on lunch yesterday from Cash', modelText);
    assert.equal(reply.proposal?.transaction.amount, '50000.0000');
    assert.equal(reply.proposal?.transaction.description, 'Lunch at "Pho 24"');
    assert.equal(reply.proposal?.transaction.transactionDate, '2026-10-11T03:00:00.000Z');
  });

  it('drops a proposal whose category is of the other type', async () => {
    const modelText = JSON.stringify({
      intent: 'RECORD_TRANSACTION',
      content: 'Draft ready.',
      proposal: {
        type: 'EXPENSE',
        accountId: '22222222-2222-2222-2222-222222222222',
        categoryId: '44444444-4444-4444-4444-444444444444',
        amount: '50000',
        currency: 'VND',
      },
    });
    const reply = await askGemini('Spent 50k from Cash', modelText);
    assert.equal(reply.proposal, undefined);
    assert.equal(reply.content, 'Draft ready.');
  });
});
