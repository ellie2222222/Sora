import { strict as assert } from 'node:assert';
import { describe, it } from 'node:test';
import {
  AccountType,
  CategoryType,
  formatMoney,
  TransactionType,
  WalletRole,
  WalletStatus,
  type DashboardResponse,
} from '@sora/contracts';

import {
  buildAiContext,
  cleanJsonText,
  executeWithGemini,
  rawGeminiResponseSchema,
  UserIntent,
} from '../src/ai/intent-context.ts';
import {
  detectUserIntent,
  executeIntent,
  groupContextForAi,
  MockLlmProvider,
} from '../src/ai/mock-llm.provider.ts';
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

describe('Context Grouping for AI (groupContextForAi)', () => {
  it('selectively groups wallet and account context for transaction recording', async () => {
    const detected = detectUserIntent({ message: 'Spent 50k on lunch', locale: 'en' });
    const toolbox = createMockToolbox();
    const request: LlmRequest = {
      message: 'Spent 50k on lunch',
      locale: 'en',
      history: [],
      toolbox,
      now: new Date('2026-10-12T00:00:00Z'),
    };

    const grouped = await groupContextForAi(detected, request);

    assert.equal(grouped.intent, UserIntent.RECORD_TRANSACTION);
    assert.ok(grouped.walletContext);
    assert.equal(grouped.walletContext?.walletName, 'Personal Wallet');
    assert.equal(grouped.walletContext?.canWrite, true);
    assert.equal(grouped.walletContext?.accounts.length, 1);
    assert.ok(grouped.systemInstructions.includes('Intent: RECORD_TRANSACTION'));
  });

  it('groups active budgets for budget queries without unnecessary transaction drafting details', async () => {
    const detected = detectUserIntent({ message: 'What are my budgets?', locale: 'en' });
    const toolbox = createMockToolbox();
    const request: LlmRequest = {
      message: 'What are my budgets?',
      locale: 'en',
      history: [],
      toolbox,
      now: new Date('2026-10-12T00:00:00Z'),
    };

    const grouped = await groupContextForAi(detected, request);

    assert.equal(grouped.intent, UserIntent.QUERY_BUDGETS);
    assert.ok(grouped.financialData?.budgets);
    assert.equal(grouped.financialData?.budgets?.[0]?.name, 'Monthly Dining');
    assert.equal(grouped.financialData?.budgets?.[0]?.usagePercentage, 83);
  });

  it('sets viewer-only warnings in system instructions when caller cannot write', async () => {
    const detected = detectUserIntent({ message: 'Spent 50k on coffee', locale: 'en' });
    const toolbox = createMockToolbox({
      snapshot: { role: WalletRole.VIEWER },
    });
    const request: LlmRequest = {
      message: 'Spent 50k on coffee',
      locale: 'en',
      history: [],
      toolbox,
      now: new Date('2026-10-12T00:00:00Z'),
    };

    const grouped = await groupContextForAi(detected, request);
    assert.equal(grouped.walletContext?.canWrite, false);
    assert.ok(grouped.systemInstructions.includes('VIEWER-only'));
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

    const context = await groupContextForAi(detected, request);
    const reply = await executeIntent(context, request);

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

    const context = await groupContextForAi(detected, request);
    const reply = await executeIntent(context, request);

    assert.equal(reply.proposal, undefined);
    assert.ok(reply.content.includes('view-only'));
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

    const context = await groupContextForAi(detected, request);
    const reply = await executeIntent(context, request);

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

describe('Gemini Execution Fallback & Model Failover (executeWithGemini)', () => {
  it('falls back seamlessly to deterministic executeIntent on network or auth failure', async () => {
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

    const context = await groupContextForAi(detected, request);

    // Call executeWithGemini with an invalid fake key pointing to non-existent endpoint / network error
    const reply = await executeWithGemini(
      context,
      request,
      {
        apiKey: 'invalid-fake-key-for-test-fallback',
        model: 'non-existent-model',
      },
      () => new MockLlmProvider().reply(request),
    );

    // Fallback executes cleanly and produces the deterministic proposal!
    assert.ok(reply.proposal);
    assert.equal(reply.proposal?.accountName, 'Cash');
    assert.equal(reply.proposal?.transaction.amount, '50000.0000');
  });

  it('fails over immediately from rate-limited primary model (429) to fallback model', async () => {
    const originalFetch = globalThis.fetch;
    const calls: string[] = [];

    globalThis.fetch = (async (input: any) => {
      const url = String(input);
      if (url.includes('gemini-3.8-flash')) {
        calls.push('gemini-3.8-flash');
        return new Response(JSON.stringify({ error: { code: 429, message: 'Resource exhausted' } }), {
          status: 429,
          headers: { 'Content-Type': 'application/json' },
        });
      }
      if (url.includes('gemini-3.1-flash-lite')) {
        calls.push('gemini-3.1-flash-lite');
        return new Response(
          JSON.stringify({
            candidates: [
              {
                content: {
                  parts: [{ text: '```json\n{"content": "Success from fallback model!"}\n```' }],
                },
              },
            ],
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } },
        );
      }
      throw new Error('Unexpected model: ' + url);
    }) as any;

    try {
      const message = 'Who are you?';
      const detected = detectUserIntent({ message, locale: 'en' });
      const toolbox = createMockToolbox();
      const request: LlmRequest = {
        message,
        locale: 'en',
        history: [],
        toolbox,
        now: new Date('2026-10-12T00:00:00Z'),
      };
      const context = await groupContextForAi(detected, request);

      const reply = await executeWithGemini(context, request, {
        apiKey: 'test-key',
        model: 'gemini-3.8-flash',
        fallbackModel: 'gemini-3.1-flash-lite',
      });

      assert.deepEqual(calls, ['gemini-3.8-flash', 'gemini-3.1-flash-lite']);
      assert.equal(reply.content, 'Success from fallback model!');
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
    assert.ok(context.financialData.balances);
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
