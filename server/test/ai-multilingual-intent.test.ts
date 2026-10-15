import { strict as assert } from 'node:assert';
import { describe, it } from 'node:test';

import type { AppConfig } from '../src/config/env.ts';
import { IntentSchema, IntentDetectorService } from '../src/ai/services/intent-detector.service.ts';
import { ModelRouterService, selectTask } from '../src/ai/services/model-router.service.ts';
import { QueryPlannerService } from '../src/ai/services/query-planner.service.ts';
import type { WalletAccess } from '../src/wallets/wallet-access.service.ts';
import { WalletRole, WalletStatus } from '@sora/contracts';

describe('AI Multilingual Intent & Planning Engine', () => {
  const mockConfig: AppConfig = {
    NODE_ENV: 'test',
    PORT: 3000,
    DATABASE_URL: 'postgres://localhost/test',
    DATABASE_POOL_MAX: 10,
    DATABASE_STATEMENT_TIMEOUT_MS: 15_000,
    DATABASE_CONNECTION_TIMEOUT_MS: 5_000,
    DATABASE_IDLE_TIMEOUT_MS: 30_000,
    CORS_ORIGINS: [],
    JWT_SECRET: '01234567890123456789012345678901',
    JWT_ISSUER: 'sora-server',
    ACCESS_TOKEN_TTL_SECONDS: 900,
    REFRESH_TOKEN_TTL_DAYS: 7,
    INVITATION_TTL_DAYS: 7,
    AUTH_RATE_LIMIT_PER_MINUTE: 10,
    LOGIN_FAILURE_LIMIT: 5,
    LOGIN_LOCKOUT_MINUTES: 15,
    APP_VERSION: '0.1.0',
    GOOGLE_CLIENT_ID: ['test-google-client-id'],
    EXCHANGE_RATE_API_URL: 'https://open.er-api.com/v6/latest',
    EXCHANGE_RATE_TIMEOUT_SECONDS: 5,
    EXCHANGE_RATE_CACHE_TTL_MINUTES: 720,
    GEMINI_API_KEY: undefined, // offline / deterministic test mode
    GEMINI_MODEL: 'gemini-3.8-flash',
    GEMINI_MODEL_INTENT: 'gemini-3.8-flash',
    GEMINI_MODEL_CHAT: 'gemini-3.8-flash',
    GEMINI_MODEL_ANALYSIS: 'gemini-3.8-flash',
    GEMINI_MODEL_COMPLEX: 'gemini-3.1-pro-preview',
    GEMINI_FALLBACK_MODEL: 'gemini-3.1-flash-lite',
  };

  const modelRouter = new ModelRouterService(mockConfig);
  const intentDetector = new IntentDetectorService(mockConfig, modelRouter);
  const queryPlanner = new QueryPlannerService();

  const mockWalletAccess: WalletAccess = {
    walletId: 'w-123',
    walletName: "Tam's Wallet",
    role: WalletRole.OWNER,
    ownerUserId: 'u-1',
    status: WalletStatus.ACTIVE,
    timeZone: 'Asia/Ho_Chi_Minh',
    relationLabel: null,
    memberId: 'm-1',
  };

  describe('Model Selection by Task (not by user language)', () => {
    it('routes each task to its configured model tier', () => {
      assert.equal(modelRouter.getModel('intent'), 'gemini-3.8-flash');
      assert.equal(modelRouter.getModel('chat'), 'gemini-3.8-flash');
      assert.equal(modelRouter.getModel('analysis'), 'gemini-3.8-flash');
      assert.equal(modelRouter.getModel('complex'), 'gemini-3.1-pro-preview');
    });

    it('selects task based on intent classification', () => {
      assert.equal(selectTask({ intent: 'spending_summary', language: 'vi', period: { type: 'this_month', count: null, startDate: null, endDate: null }, groupBy: 'none', filters: { category: null, keyword: null }, missingInformation: [] }), 'analysis');
      assert.equal(selectTask({ intent: 'financial_advice', language: 'en', period: { type: 'not_applicable', count: null, startDate: null, endDate: null }, groupBy: 'none', filters: { category: null, keyword: null }, missingInformation: [] }), 'complex');
      assert.equal(selectTask({ intent: 'general_chat', language: 'ja', period: { type: 'not_applicable', count: null, startDate: null, endDate: null }, groupBy: 'none', filters: { category: null, keyword: null }, missingInformation: [] }), 'chat');
      assert.equal(selectTask({ intent: 'budget_status', language: 'ru', period: { type: 'this_month', count: null, startDate: null, endDate: null }, groupBy: 'none', filters: { category: null, keyword: null }, missingInformation: [] }), 'analysis');
    });
  });

  describe('Multilingual Intent Equivalence (Spending Summary for 3 Months)', () => {
    const cases = [
      { text: 'Calculate my spending for the last 3 months.', expectedLang: 'en' },
      { text: 'Tính tổng chi tiêu 3 tháng gần đây.', expectedLang: 'vi' },
      { text: 'За сколько я потратил за последние 3 месяца?', expectedLang: 'ru' },
      { text: '過去3か月の支出を計算して', expectedLang: 'ja' },
      { text: '지난 3개월 동안의 지출을 계산해줘', expectedLang: 'ko' },
    ];

    for (const { text, expectedLang } of cases) {
      it(`maps "${text}" to spending_summary with period count 3 and language ${expectedLang}`, async () => {
        const result = await intentDetector.detect(text);
        assert.doesNotThrow(() => IntentSchema.parse(result));
        assert.equal(result.intent, 'spending_summary');
        assert.equal(result.period.type, 'last_n_calendar_months');
        assert.equal(result.period.count, 3);
        assert.equal(result.language, expectedLang);
      });
    }
  });

  describe('Multilingual Category Breakdown (Food expenses this month)', () => {
    const cases = [
      { text: 'Show my food expenses this month.', expectedLang: 'en' },
      { text: 'Tôi đã tiêu bao nhiêu tiền ăn tháng này?', expectedLang: 'vi' },
      { text: 'Сколько я потратил на еду в этом месяце?', expectedLang: 'ru' },
      { text: '今月の食費はいくらですか？', expectedLang: 'ja' },
    ];

    for (const { text, expectedLang } of cases) {
      it(`maps "${text}" to category_breakdown with category 'food' and language ${expectedLang}`, async () => {
        const result = await intentDetector.detect(text);
        assert.doesNotThrow(() => IntentSchema.parse(result));
        assert.equal(result.intent, 'category_breakdown');
        assert.equal(result.period.type, 'this_month');
        assert.equal(result.filters.category, 'food');
        assert.equal(result.groupBy, 'category');
        assert.equal(result.language, expectedLang);
      });
    }
  });

  describe('Multilingual Budget and Goal Status', () => {
    it('detects budget queries in English, Vietnamese, and Russian', async () => {
      const en = await intentDetector.detect('Check my budget status');
      assert.equal(en.intent, 'budget_status');
      assert.equal(en.language, 'en');

      const vi = await intentDetector.detect('Kiểm tra tình hình ngân sách');
      assert.equal(vi.intent, 'budget_status');
      assert.equal(vi.language, 'vi');

      const ru = await intentDetector.detect('Какой статус моего бюджета?');
      assert.equal(ru.intent, 'budget_status');
      assert.equal(ru.language, 'ru');
    });

    it('detects savings goal queries in English, Vietnamese, and Russian', async () => {
      const en = await intentDetector.detect('How is my savings goal progressing?');
      assert.equal(en.intent, 'goal_status');
      assert.equal(en.language, 'en');

      const vi = await intentDetector.detect('Tiến độ mục tiêu tiết kiệm thế nào rồi?');
      assert.equal(vi.intent, 'goal_status');
      assert.equal(vi.language, 'vi');

      const ru = await intentDetector.detect('Как продвигается моя цель накоплений?');
      assert.equal(ru.intent, 'goal_status');
      assert.equal(ru.language, 'ru');
    });
  });

  describe('QueryPlannerService Timezone and Date Resolution', () => {
    // Fixed instant: 2026-10-12T15:00:00Z (which is 2026-10-12 22:00 in Asia/Ho_Chi_Minh)
    const fixedNow = new Date('2026-10-12T15:00:00.000Z');

    it('resolves last_n_calendar_months (count = 3) deterministically', async () => {
      const intent = await intentDetector.detect('Tính tổng chi tiêu 3 tháng gần đây.');
      const plan = await queryPlanner.plan(intent, mockWalletAccess, fixedNow);

      assert.equal(plan.operation, 'SPENDING_SUMMARY');
      assert.equal(plan.walletId, 'w-123');
      assert.equal(plan.timeZone, 'Asia/Ho_Chi_Minh');
      assert.ok(plan.dateRange);
      assert.equal(plan.dateRange.startDate, '2026-08-01');
      assert.equal(plan.dateRange.endDate, '2026-10-31');
    });

    it('resolves this_month in wallet timezone', async () => {
      const intent = await intentDetector.detect('Show my food expenses this month.');
      const plan = await queryPlanner.plan(intent, mockWalletAccess, fixedNow);

      assert.equal(plan.operation, 'CATEGORY_BREAKDOWN');
      assert.ok(plan.dateRange);
      assert.equal(plan.dateRange.startDate, '2026-10-01');
      assert.equal(plan.dateRange.endDate, '2026-10-31');
      assert.equal(plan.filters.categoryName, 'food');
    });

    it('resolves rolling_days (count = 7) in wallet timezone', async () => {
      const intent = await intentDetector.detect('Chi tiêu 7 ngày qua');
      const plan = await queryPlanner.plan(intent, mockWalletAccess, fixedNow);

      assert.equal(plan.operation, 'SPENDING_SUMMARY');
      assert.ok(plan.dateRange);
      assert.equal(plan.dateRange.startDate, '2026-10-06');
      assert.equal(plan.dateRange.endDate, '2026-10-12');
    });

    it('resolves today and yesterday in wallet timezone', () => {
      const todayRange = queryPlanner.resolveDateRange(
        { intent: 'spending_summary', language: 'en', period: { type: 'today', count: null, startDate: null, endDate: null }, groupBy: 'none', filters: { category: null, keyword: null }, missingInformation: [] },
        'Asia/Ho_Chi_Minh',
        fixedNow,
      );
      assert.deepEqual(todayRange, {
        startDate: '2026-10-12',
        endDate: '2026-10-12',
        timeZone: 'Asia/Ho_Chi_Minh',
      });

      const ydayRange = queryPlanner.resolveDateRange(
        { intent: 'spending_summary', language: 'en', period: { type: 'yesterday', count: null, startDate: null, endDate: null }, groupBy: 'none', filters: { category: null, keyword: null }, missingInformation: [] },
        'Asia/Ho_Chi_Minh',
        fixedNow,
      );
      assert.deepEqual(ydayRange, {
        startDate: '2026-10-11',
        endDate: '2026-10-11',
        timeZone: 'Asia/Ho_Chi_Minh',
      });
    });

    it('resolves last_month in wallet timezone', () => {
      const lastMonthRange = queryPlanner.resolveDateRange(
        { intent: 'spending_summary', language: 'en', period: { type: 'last_month', count: null, startDate: null, endDate: null }, groupBy: 'none', filters: { category: null, keyword: null }, missingInformation: [] },
        'Asia/Ho_Chi_Minh',
        fixedNow,
      );
      assert.deepEqual(lastMonthRange, {
        startDate: '2026-09-01',
        endDate: '2026-09-30',
        timeZone: 'Asia/Ho_Chi_Minh',
      });
    });
  });
});

