import { Injectable, Logger } from '@nestjs/common';
import {
  aiTransactionDraftSchema,
  formatMoney,
  formatMoneyCompact,
  MoneyError,
  parseMoney,
  REQUIRED_ROLE,
  roleSatisfies,
  TransactionType,
  WalletStatus,
  type CurrencyTotal,
  type Locale,
} from '@sora/contracts';

import { UserIntent, type GroupedAiContext } from './intent-context.ts';
import type {
  LlmProvider,
  LlmReply,
  LlmRequest,
  WalletSnapshot,
} from './llm-provider.ts';

// ---------------------------------------------------------------------------
// Deterministic Mock Entities & Interfaces (Offline / Tests Only)
// ---------------------------------------------------------------------------

export interface TransactionEntities {
  type: 'INCOME' | 'EXPENSE';
  amount: bigint | null;
  formattedAmount: string | null;
  currency: string | null;
  accountHint: string | null;
  categoryHint: string | null;
  description: string | null;
  date: string | null;
}

export interface SpendingEntities {
  categoryHint: string | null;
  timeframe: string | null;
}

export interface BudgetEntities {
  categoryHint: string | null;
  budgetNameHint: string | null;
}

export interface GoalEntities {
  goalNameHint: string | null;
}

export interface IntentEntities {
  [key: string]: unknown;
  transaction?: TransactionEntities;
  spending?: SpendingEntities;
  budget?: BudgetEntities;
  goal?: GoalEntities;
}

export interface IntentDetectionContext {
  message: string;
  locale: Locale;
  history?: { role: any; content: string }[];
  now?: Date;
}

export interface DetectedIntentResult {
  intent: UserIntent;
  confidence: number;
  entities: IntentEntities;
  rawMessage: string;
  normalizedMessage: string;
}

// ---------------------------------------------------------------------------
// Static Keyword Arrays (Heuristic Mock Simulator)
// ---------------------------------------------------------------------------

const EXPENSE_WORDS = ['spent', 'spend', 'paid', 'pay', 'bought', 'buy', 'cost', 'chi', 'tieu', 'mua', 'tra', 'het'];
const INCOME_WORDS = ['received', 'receive', 'earned', 'earn', 'got paid', 'salary', 'income', 'nhan', 'luong', 'thuong', 'bonus'];
const BALANCE_WORDS = ['balance', 'balances', 'how much do i have', 'so du', 'con bao nhieu'];
const BUDGET_WORDS = ['budget', 'budgets', 'ngan sach'];
const GOAL_WORDS = ['goal', 'goals', 'saving', 'savings', 'muc tieu', 'tiet kiem'];
const QUESTION_WORDS = ['how much', 'how many', 'what', 'bao nhieu', 'khong', 'check', 'kiem tra', 'cho toi biet'];
const SPENDING_WORDS = ['spend', 'spent', 'spending', 'expense', 'expenses', 'chi tieu'];

export function detectUserIntent(context: IntentDetectionContext): DetectedIntentResult {
  const normalized = normalize(context.message);
  const amount = parseAmount(context.message);
  const direction: 'INCOME' | 'EXPENSE' | null = hasAny(normalized, INCOME_WORDS)
    ? TransactionType.INCOME
    : hasAny(normalized, EXPENSE_WORDS)
      ? TransactionType.EXPENSE
      : null;

  const isQuestion = context.message.includes('?') || hasAny(normalized, QUESTION_WORDS);

  if (amount !== null && direction !== null && !isQuestion) {
    const currency = mentionedCurrency(context.message);
    return {
      intent: UserIntent.RECORD_TRANSACTION,
      confidence: 0.95,
      entities: {
        transaction: {
          type: direction,
          amount,
          formattedAmount: formatMoney(amount),
          currency,
          accountHint: null,
          categoryHint: null,
          description: context.message.trim().slice(0, 200),
          date: (context.now ?? new Date()).toISOString(),
        },
      },
      rawMessage: context.message,
      normalizedMessage: normalized,
    };
  }

  if (hasAny(normalized, BUDGET_WORDS)) {
    return {
      intent: UserIntent.QUERY_BUDGETS,
      confidence: 0.9,
      entities: { budget: { categoryHint: null, budgetNameHint: null } },
      rawMessage: context.message,
      normalizedMessage: normalized,
    };
  }

  if (hasAny(normalized, GOAL_WORDS)) {
    return {
      intent: UserIntent.QUERY_GOALS,
      confidence: 0.9,
      entities: { goal: { goalNameHint: null } },
      rawMessage: context.message,
      normalizedMessage: normalized,
    };
  }

  if (hasAny(normalized, BALANCE_WORDS)) {
    return {
      intent: UserIntent.QUERY_BALANCES,
      confidence: 0.9,
      entities: {},
      rawMessage: context.message,
      normalizedMessage: normalized,
    };
  }

  if (hasAny(normalized, SPENDING_WORDS)) {
    return {
      intent: UserIntent.QUERY_SPENDING,
      confidence: 0.85,
      entities: { spending: { categoryHint: null, timeframe: 'CURRENT_MONTH' } },
      rawMessage: context.message,
      normalizedMessage: normalized,
    };
  }

  return {
    intent: UserIntent.GENERAL_ASSISTANCE,
    confidence: 0.5,
    entities: {},
    rawMessage: context.message,
    normalizedMessage: normalized,
  };
}

export async function groupContextForAi(
  detected: DetectedIntentResult,
  request: LlmRequest,
): Promise<GroupedAiContext> {
  const { toolbox, locale, now, history } = request;

  let walletContext: GroupedAiContext['walletContext'] | undefined;
  let financialData: GroupedAiContext['financialData'] | undefined;

  switch (detected.intent) {
    case UserIntent.RECORD_TRANSACTION: {
      const snapshot = await toolbox.walletSnapshot();
      walletContext = {
        walletId: snapshot.walletId,
        walletName: snapshot.walletName,
        role: snapshot.role,
        canWrite: roleSatisfies(snapshot.role, REQUIRED_ROLE.WRITE),
        status: snapshot.status,
        accounts: snapshot.accounts,
        categories: snapshot.categories,
      };
      break;
    }

    case UserIntent.QUERY_BALANCES: {
      const snapshot = await toolbox.walletSnapshot();
      walletContext = {
        walletId: snapshot.walletId,
        walletName: snapshot.walletName,
        role: snapshot.role,
        canWrite: roleSatisfies(snapshot.role, REQUIRED_ROLE.WRITE),
        status: snapshot.status,
        accounts: snapshot.accounts,
        categories: [],
      };
      financialData = {
        balances: snapshot.accounts.map((acc) => ({
          accountName: acc.name,
          balance: acc.balance,
          currency: acc.currency,
        })),
      };
      break;
    }

    case UserIntent.QUERY_SPENDING: {
      const summary = await toolbox.monthSummary();
      financialData = {
        monthSpending: {
          totals: summary.expense,
          byCategory: summary.spendingByCategory.map((c) => ({
            categoryName: c.categoryName,
            percentage: c.percentage,
          })),
        },
      };
      break;
    }

    case UserIntent.QUERY_BUDGETS: {
      const summary = await toolbox.monthSummary();
      financialData = {
        budgets: summary.activeBudgets.map((b) => ({
          name: b.name,
          spent: b.spent,
          amount: b.amount,
          currency: b.currency,
          usagePercentage: b.usagePercentage,
          isOverBudget: b.isOverBudget,
        })),
      };
      break;
    }

    case UserIntent.QUERY_GOALS: {
      const summary = await toolbox.monthSummary();
      financialData = {
        goals: summary.activeGoals.map((g) => ({
          name: g.name,
          currentAmount: g.currentAmount,
          targetAmount: g.targetAmount,
          currency: g.currency,
          progressPercentage: g.progressPercentage,
        })),
      };
      break;
    }

    case UserIntent.GENERAL_ASSISTANCE:
    default: {
      const [snapshot, summary] = await Promise.all([
        toolbox.walletSnapshot(),
        toolbox.monthSummary(),
      ]);
      walletContext = {
        walletId: snapshot.walletId,
        walletName: snapshot.walletName,
        role: snapshot.role,
        canWrite: roleSatisfies(snapshot.role, REQUIRED_ROLE.WRITE),
        status: snapshot.status,
        accounts: snapshot.accounts,
        categories: snapshot.categories,
      };
      financialData = {
        balances: snapshot.accounts.map((acc) => ({
          accountName: acc.name,
          balance: acc.balance,
          currency: acc.currency,
        })),
        monthSpending: {
          totals: summary.expense,
          byCategory: summary.spendingByCategory.map((c) => ({
            categoryName: c.categoryName,
            percentage: c.percentage,
          })),
        },
        budgets: summary.activeBudgets.map((b) => ({
          name: b.name,
          spent: b.spent,
          amount: b.amount,
          currency: b.currency,
          usagePercentage: b.usagePercentage,
          isOverBudget: b.isOverBudget,
        })),
        goals: summary.activeGoals.map((g) => ({
          name: g.name,
          currentAmount: g.currentAmount,
          targetAmount: g.targetAmount,
          currency: g.currency,
          progressPercentage: g.progressPercentage,
        })),
      };
      break;
    }
  }

  const systemInstructions = buildSystemInstructions(detected.intent, locale, walletContext, financialData);

  return {
    intent: detected.intent,
    confidence: detected.confidence,
    entities: detected.entities,
    userMessage: request.message,
    locale,
    now,
    systemInstructions,
    walletContext,
    financialData,
    history,
  };
}

function buildSystemInstructions(
  intent: UserIntent,
  locale: Locale,
  walletContext?: GroupedAiContext['walletContext'],
  financialData?: GroupedAiContext['financialData'],
): string {
  const parts: string[] = [
    `You are the embedded finance assistant for Sora. Your goal is to resolve user queries concisely and accurately.`,
    `Locale: ${locale}.`,
    `Intent: ${intent}.`,
  ];
  if (walletContext) {
    parts.push(`Current wallet: ${walletContext.walletName} (${walletContext.walletId}).`);
    if (!walletContext.canWrite) {
      parts.push(`The user has VIEWER-only access. You MUST NOT propose any transaction drafts.`);
    }
  }
  if (financialData) {
    parts.push(`Financial data: ${JSON.stringify(financialData)}`);
  }
  return parts.join('\n');
}

export async function executeIntent(context: GroupedAiContext, request: LlmRequest): Promise<LlmReply> {
  const copy = COPY[context.locale];

  switch (context.intent) {
    case UserIntent.RECORD_TRANSACTION: {
      const entities = context.entities.transaction as TransactionEntities | undefined;
      if (!entities || entities.amount === null) return { content: copy.help };

      const snapshot = await request.toolbox.walletSnapshot();
      if (!roleSatisfies(snapshot.role, REQUIRED_ROLE.WRITE)) return { content: copy.viewerOnly(snapshot.walletName) };
      if (snapshot.status !== WalletStatus.ACTIVE) return { content: copy.walletArchived(snapshot.walletName) };
      if (snapshot.accounts.length === 0) return { content: copy.noAccounts };

      const normalized = normalize(request.message);
      const account =
        longestNameMatch(normalized, snapshot.accounts) ?? (snapshot.accounts.length === 1 ? snapshot.accounts[0] : undefined);
      if (account === undefined) {
        return { content: copy.whichAccount(snapshot.accounts.map((item) => item.name)) };
      }

      const mentioned = entities.currency ?? mentionedCurrency(request.message);
      if (mentioned !== null && mentioned !== account.currency) {
        return { content: copy.currencyMismatch(account.name, account.currency, mentioned) };
      }

      const category = pickCategory(normalized, snapshot, entities.type);
      if (category === undefined) return { content: copy.noCategory(entities.type) };

      const transaction = aiTransactionDraftSchema.parse({
        type: entities.type,
        ...(entities.type === TransactionType.EXPENSE ? { fromAccountId: account.id } : { toAccountId: account.id }),
        categoryId: category.id,
        amount: formatMoney(entities.amount),
        currency: account.currency,
        description: request.message.trim().slice(0, 200),
        transactionDate: request.now.toISOString(),
      });

      return {
        content: copy.proposal(entities.type, displayAmount(transaction.amount, account.currency, request.locale), account.name, category.name),
        proposal: { transaction, accountName: account.name, categoryName: category.name },
      };
    }

    case UserIntent.QUERY_BALANCES: {
      const snapshot = await request.toolbox.walletSnapshot();
      if (snapshot.accounts.length === 0) return { content: copy.noAccounts };
      const lines = snapshot.accounts.map(
        (account) => `• ${account.name}: ${displayAmount(account.balance, account.currency, request.locale)}`,
      );
      return { content: `${copy.balancesIntro(snapshot.walletName)}\n${lines.join('\n')}` };
    }

    case UserIntent.QUERY_SPENDING: {
      const summary = await request.toolbox.monthSummary();
      if (summary.expense.length === 0) return { content: copy.noSpending };
      const totals = joinTotals(summary.expense, request.locale);
      const top = summary.spendingByCategory
        .slice(0, 3)
        .map((slice) => `• ${slice.categoryName}: ${slice.percentage}%`)
        .join('\n');
      return { content: top.length > 0 ? `${copy.spendingIntro(totals)}\n${top}` : copy.spendingIntro(totals) };
    }

    case UserIntent.QUERY_BUDGETS: {
      const summary = await request.toolbox.monthSummary();
      if (summary.activeBudgets.length === 0) return { content: copy.noBudgets };
      const lines = summary.activeBudgets.map((budget) =>
        copy.budgetLine(
          budget.name,
          displayAmount(budget.spent, budget.currency, request.locale),
          displayAmount(budget.amount, budget.currency, request.locale),
          budget.usagePercentage,
          budget.isOverBudget,
        ),
      );
      return { content: `${copy.budgetsIntro}\n${lines.join('\n')}` };
    }

    case UserIntent.QUERY_GOALS: {
      const summary = await request.toolbox.monthSummary();
      if (summary.activeGoals.length === 0) return { content: copy.noGoals };
      const lines = summary.activeGoals.map((goal) =>
        copy.goalLine(
          goal.name,
          displayAmount(goal.currentAmount, goal.currency, request.locale),
          displayAmount(goal.targetAmount, goal.currency, request.locale),
          goal.progressPercentage,
        ),
      );
      return { content: `${copy.goalsIntro}\n${lines.join('\n')}` };
    }

    case UserIntent.GENERAL_ASSISTANCE:
    default:
      return { content: copy.help };
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

export function normalize(input: string): string {
  return input.normalize('NFD').replace(/\p{M}/gu, '').replace(/đ/g, 'd').replace(/Đ/g, 'd').toLowerCase();
}

export function hasAny(text: string, phrases: readonly string[]): boolean {
  return phrases.some((phrase) => containsPhrase(text, phrase));
}

export function containsPhrase(text: string, phrase: string): boolean {
  const escaped = phrase.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return new RegExp(`(^|[^a-z0-9])${escaped}($|[^a-z0-9])`).test(text);
}

const MULTIPLIERS: Record<string, bigint> = {
  k: 1_000n,
  nghin: 1_000n,
  ngan: 1_000n,
  tr: 1_000_000n,
  trieu: 1_000_000n,
  m: 1_000_000n,
  million: 1_000_000n,
};

export function parseAmount(message: string): bigint | null {
  const match = normalize(message).match(
    /(\d{1,3}(?:[.,]\d{3})+|\d+(?:[.,]\d{1,4})?)\s*(million|trieu|nghin|ngan|tr|k|m)?(?![a-z])/,
  );
  if (!match) return null;

  const [, digits, suffix] = match;
  const decimal =
    /^\d{1,3}(?:[.,]\d{3})+$/.test(digits!) && suffix === undefined
      ? digits!.replace(/[.,]/g, '')
      : digits!.replace(',', '.');
  try {
    const value = parseMoney(decimal) * (suffix ? MULTIPLIERS[suffix]! : 1n);
    return value > 0n ? value : null;
  } catch (error) {
    if (error instanceof MoneyError) return null;
    throw error;
  }
}

const CURRENCY_CODES = ['USD', 'VND', 'EUR', 'JPY', 'GBP', 'AUD', 'SGD', 'KRW', 'CNY', 'THB'];

export function mentionedCurrency(message: string): string | null {
  const code = message.toUpperCase().match(new RegExp(`(^|[^A-Z])(${CURRENCY_CODES.join('|')})($|[^A-Z])`));
  if (code) return code[2]!;
  if (message.includes('$')) return 'USD';
  if (/₫|\d\s*đ(?![a-zà-ỹ])/i.test(message) || containsPhrase(normalize(message), 'dong')) return 'VND';
  return null;
}

export function longestNameMatch<T extends { name: string }>(text: string, items: readonly T[]): T | undefined {
  return items
    .filter((item) => containsPhrase(text, normalize(item.name)))
    .sort((a, b) => b.name.length - a.name.length)[0];
}

export const CATEGORY_HINTS: { words: string[]; categories: string[] }[] = [
  { words: ['lunch', 'dinner', 'breakfast', 'meal', 'food', 'pho', 'com', 'bun', 'an trua', 'an toi', 'an sang'], categories: ['food', 'dining out'] },
  { words: ['coffee', 'cafe', 'ca phe', 'tra sua', 'drink', 'drinks'], categories: ['drinks', 'dining out'] },
  { words: ['grocery', 'groceries', 'sieu thi', 'di cho'], categories: ['groceries'] },
  { words: ['grab', 'taxi', 'bus', 'fuel', 'gas', 'xang', 'parking', 'gui xe'], categories: ['transportation'] },
  { words: ['electric', 'electricity', 'water', 'internet', 'tien dien', 'tien nuoc'], categories: ['utilities', 'bills'] },
  { words: ['rent', 'thue nha', 'tien nha'], categories: ['housing'] },
  { words: ['movie', 'movies', 'cinema', 'phim'], categories: ['movies', 'entertainment'] },
  { words: ['salary', 'luong'], categories: ['salary'] },
  { words: ['bonus', 'thuong'], categories: ['bonus'] },
  { words: ['refund', 'hoan tien'], categories: ['refund'] },
  { words: ['gift', 'qua', 'li xi'], categories: ['gift'] },
];

export function pickCategory(text: string, snapshot: WalletSnapshot, type: TransactionType) {
  const candidates = snapshot.categories.filter((category) => category.type === type);
  const byName = (name: string) => candidates.find((category) => normalize(category.name) === name);

  const direct = longestNameMatch(text, candidates);
  if (direct) return direct;

  for (const hint of CATEGORY_HINTS) {
    if (!hasAny(text, hint.words)) continue;
    const found = hint.categories.map(byName).find((category) => category !== undefined);
    if (found) return found;
  }

  return (
    candidates.find((category) => /(^|\s)(other|khac)(\s|$)/.test(normalize(category.name))) ?? candidates[0]
  );
}

export const NUMBER_FORMAT: Readonly<Record<Locale, { group: string; decimal: string }>> = {
  en: { group: ',', decimal: '.' },
  vi: { group: '.', decimal: ',' },
  de: { group: '.', decimal: ',' },
  es: { group: '.', decimal: ',' },
  fr: { group: ' ', decimal: ',' },
  hi: { group: ',', decimal: '.' },
  ja: { group: ',', decimal: '.' },
  ko: { group: ',', decimal: '.' },
  ru: { group: ' ', decimal: ',' },
  zh: { group: ',', decimal: '.' },
};

export function displayAmount(amount: string, currency: string, locale: Locale): string {
  const compact = formatMoneyCompact(parseMoney(amount));
  const negative = compact.startsWith('-');
  const [whole, fraction] = (negative ? compact.slice(1) : compact).split('.');
  const { group, decimal } = NUMBER_FORMAT[locale];
  const grouped = whole!.replace(/\B(?=(\d{3})+(?!\d))/g, group);
  return `${negative ? '-' : ''}${grouped}${fraction ? decimal + fraction : ''} ${currency}`;
}

export function joinTotals(totals: CurrencyTotal[], locale: Locale): string {
  return totals.map((total) => displayAmount(total.amount, total.currency, locale)).join(' + ');
}

export const COPY = {
  en: {
    help:
      'I can record an expense or income ("Spent 50k on lunch from Cash"), and answer questions about ' +
      'your balances, this month\'s spending, budgets and goals.',
    viewerOnly: (wallet: string) => `You have view-only access to ${wallet}, so I can't prepare transactions there.`,
    walletArchived: (wallet: string) => `${wallet} is archived, so it doesn't accept new transactions.`,
    noAccounts: 'This wallet has no active accounts yet. Add one first.',
    whichAccount: (names: string[]) => `Which account was it? This wallet has: ${names.join(', ')}.`,
    currencyMismatch: (account: string, currency: string, mentioned: string) =>
      `${account} holds ${currency}, so I can't record ${mentioned} there.`,
    noCategory: (type: 'INCOME' | 'EXPENSE') =>
      `This wallet has no ${type === 'INCOME' ? 'income' : 'expense'} categories yet. Add one first.`,
    proposal: (type: 'INCOME' | 'EXPENSE', amount: string, account: string, category: string) =>
      `Here's a draft ${type === 'INCOME' ? 'income' : 'expense'} of ${amount} ${type === 'INCOME' ? 'into' : 'from'} ${account}, ` +
      `under ${category}. Confirm it to record it.`,
    balancesIntro: (wallet: string) => `Balances in ${wallet}:`,
    noSpending: 'Nothing has been spent this month yet.',
    spendingIntro: (totals: string) => `You've spent ${totals} this month.`,
    noBudgets: 'This wallet has no active budgets.',
    budgetsIntro: 'Your active budgets:',
    budgetLine: (name: string, spent: string, amount: string, usage: number, over: boolean) =>
      `• ${name}: ${spent} of ${amount} (${usage}%)${over ? ' — over budget' : ''}`,
    noGoals: 'This wallet has no active saving goals.',
    goalsIntro: 'Your saving goals:',
    goalLine: (name: string, current: string, target: string, progress: number) =>
      `• ${name}: ${current} of ${target} (${progress}%)`,
  },
  vi: {
    help:
      'Mình có thể ghi một khoản chi hoặc thu ("Chi 50k ăn trưa từ Tiền mặt"), và trả lời về số dư, ' +
      'chi tiêu tháng này, ngân sách và mục tiêu tiết kiệm.',
    viewerOnly: (wallet: string) => `Bạn chỉ có quyền xem ${wallet}, nên mình không thể tạo giao dịch ở đó.`,
    walletArchived: (wallet: string) => `${wallet} đã được lưu trữ nên không nhận giao dịch mới.`,
    noAccounts: 'Ví này chưa có tài khoản nào đang hoạt động. Hãy thêm một tài khoản trước.',
    whichAccount: (names: string[]) => `Giao dịch này ở tài khoản nào? Ví này có: ${names.join(', ')}.`,
    currencyMismatch: (account: string, currency: string, mentioned: string) =>
      `${account} dùng ${currency}, nên mình không thể ghi ${mentioned} vào đó.`,
    noCategory: (type: 'INCOME' | 'EXPENSE') =>
      `Ví này chưa có danh mục ${type === 'INCOME' ? 'thu' : 'chi'} nào. Hãy thêm một danh mục trước.`,
    proposal: (type: 'INCOME' | 'EXPENSE', amount: string, account: string, category: string) =>
      `Đây là bản nháp khoản ${type === 'INCOME' ? 'thu' : 'chi'} ${amount} ${type === 'INCOME' ? 'vào' : 'từ'} ${account}, ` +
      `danh mục ${category}. Xác nhận để ghi lại.`,
    balancesIntro: (wallet: string) => `Số dư trong ${wallet}:`,
    noSpending: 'Tháng này bạn chưa chi gì.',
    spendingIntro: (totals: string) => `Tháng này bạn đã chi ${totals}.`,
    noBudgets: 'Ví này chưa có ngân sách nào đang hoạt động.',
    budgetsIntro: 'Ngân sách đang hoạt động:',
    budgetLine: (name: string, spent: string, amount: string, usage: number, over: boolean) =>
      `• ${name}: ${spent} / ${amount} (${usage}%)${over ? ' — vượt ngân sách' : ''}`,
    noGoals: 'Ví này chưa có mục tiêu tiết kiệm nào.',
    goalsIntro: 'Mục tiêu tiết kiệm của bạn:',
    goalLine: (name: string, current: string, target: string, progress: number) =>
      `• ${name}: ${current} / ${target} (${progress}%)`,
  },
  de: {
    help: 'Ich kann eine Ausgabe oder Einnahme erfassen („50k fürs Mittagessen aus Bargeld ausgegeben“) und Fragen zu Ihren Kontoständen, Ihren Ausgaben in diesem Monat, Budgets und Sparzielen beantworten.',
    viewerOnly: (wallet: string) => `Sie haben für ${wallet} nur Lesezugriff, daher kann ich dort keine Transaktionen vorbereiten.`,
    walletArchived: (wallet: string) => `${wallet} ist archiviert und nimmt keine neuen Transaktionen an.`,
    noAccounts: 'Diese Geldbörse hat noch keine aktiven Konten. Fügen Sie zuerst eines hinzu.',
    whichAccount: (names: string[]) => `Welches Konto war es? Diese Geldbörse hat: ${names.join(', ')}.`,
    currencyMismatch: (account: string, currency: string, mentioned: string) => `${account} wird in ${currency} geführt, daher kann ich dort nichts in ${mentioned} erfassen.`,
    noCategory: (type: 'INCOME' | 'EXPENSE') => (type === 'INCOME' ? 'Diese Geldbörse hat noch keine Einnahmenkategorien. Fügen Sie zuerst eine hinzu.' : 'Diese Geldbörse hat noch keine Ausgabenkategorien. Fügen Sie zuerst eine hinzu.'),
    proposal: (type: 'INCOME' | 'EXPENSE', amount: string, account: string, category: string) =>
      type === 'INCOME' ? `Hier ist ein Entwurf für eine Einnahme von ${amount} auf ${account}, Kategorie ${category}. Bestätigen Sie ihn, um ihn zu erfassen.` : `Hier ist ein Entwurf für eine Ausgabe von ${amount} von ${account}, Kategorie ${category}. Bestätigen Sie ihn, um ihn zu erfassen.`,
    balancesIntro: (wallet: string) => `Kontostände in ${wallet}:`,
    noSpending: 'Diesen Monat wurde noch nichts ausgegeben.',
    spendingIntro: (totals: string) => `Sie haben diesen Monat ${totals} ausgegeben.`,
    noBudgets: 'Diese Geldbörse hat keine aktiven Budgets.',
    budgetsIntro: 'Ihre aktiven Budgets:',
    budgetLine: (name: string, spent: string, amount: string, usage: number, over: boolean) =>
      `• ${name}: ${spent} / ${amount} (${usage}%)${over ? ' — Budget überschritten' : ''}`,
    noGoals: 'Diese Geldbörse hat keine aktiven Sparziele.',
    goalsIntro: 'Ihre Sparziele:',
    goalLine: (name: string, current: string, target: string, progress: number) => `• ${name}: ${current} / ${target} (${progress}%)`,
  },
  es: {
    help: 'Puedo registrar un gasto o un ingreso ("Gasté 50k en el almuerzo con Efectivo") y responder preguntas sobre tus saldos, los gastos de este mes, tus presupuestos y tus metas.',
    viewerOnly: (wallet: string) => `Solo tienes acceso de lectura a ${wallet}, así que no puedo preparar transacciones ahí.`,
    walletArchived: (wallet: string) => `${wallet} está archivada, así que no acepta transacciones nuevas.`,
    noAccounts: 'Esta cartera aún no tiene cuentas activas. Añade una primero.',
    whichAccount: (names: string[]) => `¿En qué cuenta fue? Esta cartera tiene: ${names.join(', ')}.`,
    currencyMismatch: (account: string, currency: string, mentioned: string) => `${account} usa ${currency}, así que no puedo registrar ${mentioned} ahí.`,
    noCategory: (type: 'INCOME' | 'EXPENSE') => (type === 'INCOME' ? 'Esta cartera aún no tiene categorías de ingresos. Añade una primero.' : 'Esta cartera aún no tiene categorías de gastos. Añade una primero.'),
    proposal: (type: 'INCOME' | 'EXPENSE', amount: string, account: string, category: string) =>
      type === 'INCOME' ? `Aquí tienes un borrador de ingreso de ${amount} a ${account}, en ${category}. Confírmalo para registrarlo.` : `Aquí tienes un borrador de gasto de ${amount} desde ${account}, en ${category}. Confírmalo para registrarlo.`,
    balancesIntro: (wallet: string) => `Saldos en ${wallet}:`,
    noSpending: 'Aún no has gastado nada este mes.',
    spendingIntro: (totals: string) => `Este mes has gastado ${totals}.`,
    noBudgets: 'Esta cartera no tiene presupuestos activos.',
    budgetsIntro: 'Tus presupuestos activos:',
    budgetLine: (name: string, spent: string, amount: string, usage: number, over: boolean) =>
      `• ${name}: ${spent} / ${amount} (${usage}%)${over ? ' — presupuesto superado' : ''}`,
    noGoals: 'Esta cartera no tiene metas de ahorro activas.',
    goalsIntro: 'Tus metas de ahorro:',
    goalLine: (name: string, current: string, target: string, progress: number) => `• ${name}: ${current} / ${target} (${progress}%)`,
  },
  fr: {
    help: 'Je peux enregistrer une dépense ou un revenu (« Dépensé 50k pour le déjeuner en Espèces ») et répondre à vos questions sur vos soldes, vos dépenses du mois, vos budgets et vos objectifs.',
    viewerOnly: (wallet: string) => `Vous n’avez qu’un accès en lecture à ${wallet}, je ne peux donc pas y préparer de transactions.`,
    walletArchived: (wallet: string) => `${wallet} est archivé et n’accepte plus de nouvelles transactions.`,
    noAccounts: 'Ce portefeuille n’a encore aucun compte actif. Ajoutez-en un d’abord.',
    whichAccount: (names: string[]) => `Sur quel compte ? Ce portefeuille contient : ${names.join(', ')}.`,
    currencyMismatch: (account: string, currency: string, mentioned: string) => `${account} est en ${currency}, je ne peux donc pas y enregistrer ${mentioned}.`,
    noCategory: (type: 'INCOME' | 'EXPENSE') => (type === 'INCOME' ? 'Ce portefeuille n’a encore aucune catégorie de revenus. Ajoutez-en une d’abord.' : 'Ce portefeuille n’a encore aucune catégorie de dépenses. Ajoutez-en une d’abord.'),
    proposal: (type: 'INCOME' | 'EXPENSE', amount: string, account: string, category: string) =>
      type === 'INCOME' ? `Voici un brouillon de revenu de ${amount} sur ${account}, dans ${category}. Confirmez pour l’enregistrer.` : `Voici un brouillon de dépense de ${amount} depuis ${account}, dans ${category}. Confirmez pour l’enregistrer.`,
    balancesIntro: (wallet: string) => `Soldes de ${wallet} :`,
    noSpending: 'Aucune dépense ce mois-ci pour l’instant.',
    spendingIntro: (totals: string) => `Vous avez dépensé ${totals} ce mois-ci.`,
    noBudgets: 'Ce portefeuille n’a aucun budget actif.',
    budgetsIntro: 'Vos budgets actifs :',
    budgetLine: (name: string, spent: string, amount: string, usage: number, over: boolean) =>
      `• ${name} : ${spent} / ${amount} (${usage} %)${over ? ' — budget dépassé' : ''}`,
    noGoals: 'Ce portefeuille n’a aucun objectif d’épargne actif.',
    goalsIntro: 'Vos objectifs d’épargne :',
    goalLine: (name: string, current: string, target: string, progress: number) => `• ${name} : ${current} / ${target} (${progress} %)`,
  },
  hi: {
    help: 'मैं कोई खर्च या आय दर्ज कर सकता हूँ ("नकद से लंच पर 50k खर्च किए"), और आपके बैलेंस, इस महीने के खर्च, बजट और लक्ष्यों के बारे में सवालों के जवाब दे सकता हूँ।',
    viewerOnly: (wallet: string) => `आपके पास ${wallet} को सिर्फ़ देखने की अनुमति है, इसलिए मैं वहाँ लेन-देन तैयार नहीं कर सकता।`,
    walletArchived: (wallet: string) => `${wallet} आर्काइव है, इसलिए इसमें नए लेन-देन नहीं जुड़ सकते।`,
    noAccounts: 'इस वॉलेट में अभी कोई सक्रिय खाता नहीं है। पहले एक खाता जोड़ें।',
    whichAccount: (names: string[]) => `यह किस खाते से था? इस वॉलेट में ये खाते हैं: ${names.join(', ')}।`,
    currencyMismatch: (account: string, currency: string, mentioned: string) => `${account} में ${currency} रखी जाती है, इसलिए मैं वहाँ ${mentioned} दर्ज नहीं कर सकता।`,
    noCategory: (type: 'INCOME' | 'EXPENSE') => (type === 'INCOME' ? 'इस वॉलेट में अभी आय की कोई श्रेणी नहीं है। पहले एक श्रेणी जोड़ें।' : 'इस वॉलेट में अभी खर्च की कोई श्रेणी नहीं है। पहले एक श्रेणी जोड़ें।'),
    proposal: (type: 'INCOME' | 'EXPENSE', amount: string, account: string, category: string) =>
      type === 'INCOME' ? `यह ${account} में ${amount} की आय का ड्राफ़्ट है, श्रेणी ${category}। दर्ज करने के लिए पुष्टि करें।` : `यह ${account} से ${amount} के खर्च का ड्राफ़्ट है, श्रेणी ${category}। दर्ज करने के लिए पुष्टि करें।`,
    balancesIntro: (wallet: string) => `${wallet} में बैलेंस:`,
    noSpending: 'इस महीने अभी तक कुछ खर्च नहीं हुआ।',
    spendingIntro: (totals: string) => `इस महीने आपने ${totals} खर्च किए हैं।`,
    noBudgets: 'इस वॉलेट में कोई सक्रिय बजट नहीं है।',
    budgetsIntro: 'आपके सक्रिय बजट:',
    budgetLine: (name: string, spent: string, amount: string, usage: number, over: boolean) =>
      `• ${name}: ${spent} / ${amount} (${usage}%)${over ? ' — बजट से ज़्यादा' : ''}`,
    noGoals: 'इस वॉलेट में कोई सक्रिय बचत लक्ष्य नहीं है।',
    goalsIntro: 'आपके बचत लक्ष्य:',
    goalLine: (name: string, current: string, target: string, progress: number) => `• ${name}: ${current} / ${target} (${progress}%)`,
  },
  ja: {
    help: '支出や収入を記録したり（例:「現金からランチに1,000円使った」）、残高、今月の支出、予算、貯金目標について答えたりできます。',
    viewerOnly: (wallet: string) => `${wallet}は閲覧のみの権限のため、そこに取引を用意することはできません。`,
    walletArchived: (wallet: string) => `${wallet}はアーカイブ済みのため、新しい取引を追加できません。`,
    noAccounts: 'このウォレットにはまだ有効な口座がありません。先に口座を追加してください。',
    whichAccount: (names: string[]) => `どの口座の取引ですか？このウォレットの口座: ${names.join(', ')}。`,
    currencyMismatch: (account: string, currency: string, mentioned: string) => `${account}は${currency}の口座のため、${mentioned}を記録することはできません。`,
    noCategory: (type: 'INCOME' | 'EXPENSE') => (type === 'INCOME' ? 'このウォレットにはまだ収入カテゴリがありません。先にカテゴリを追加してください。' : 'このウォレットにはまだ支出カテゴリがありません。先にカテゴリを追加してください。'),
    proposal: (type: 'INCOME' | 'EXPENSE', amount: string, account: string, category: string) =>
      type === 'INCOME' ? `${account}への${amount}の収入（カテゴリ: ${category}）の下書きです。確認すると記録されます。` : `${account}からの${amount}の支出（カテゴリ: ${category}）の下書きです。確認すると記録されます。`,
    balancesIntro: (wallet: string) => `${wallet}の残高:`,
    noSpending: '今月はまだ支出がありません。',
    spendingIntro: (totals: string) => `今月の支出は${totals}です。`,
    noBudgets: 'このウォレットには有効な予算がありません。',
    budgetsIntro: '有効な予算:',
    budgetLine: (name: string, spent: string, amount: string, usage: number, over: boolean) =>
      `• ${name}: ${spent} / ${amount} (${usage}%)${over ? ' — 予算超過' : ''}`,
    noGoals: 'このウォレットには進行中の貯金目標がありません。',
    goalsIntro: 'あなたの貯金目標:',
    goalLine: (name: string, current: string, target: string, progress: number) => `• ${name}: ${current} / ${target} (${progress}%)`,
  },
  ko: {
    help: '지출이나 수입을 기록하고("현금으로 점심 50k 지출"), 잔액, 이번 달 지출, 예산, 목표에 대한 질문에 답할 수 있어요.',
    viewerOnly: (wallet: string) => `${wallet}에 대한 조회 권한만 있어서 거기에는 거래를 준비할 수 없어요.`,
    walletArchived: (wallet: string) => `${wallet}은(는) 보관된 지갑이라 새 거래를 받을 수 없어요.`,
    noAccounts: '이 지갑에는 아직 사용 중인 계좌가 없어요. 먼저 계좌를 추가하세요.',
    whichAccount: (names: string[]) => `어느 계좌였나요? 이 지갑에는 ${names.join(', ')}이(가) 있어요.`,
    currencyMismatch: (account: string, currency: string, mentioned: string) => `${account}은(는) ${currency} 계좌라서 ${mentioned}을(를) 기록할 수 없어요.`,
    noCategory: (type: 'INCOME' | 'EXPENSE') => (type === 'INCOME' ? '이 지갑에는 아직 수입 카테고리가 없어요. 먼저 카테고리를 추가하세요.' : '이 지갑에는 아직 지출 카테고리가 없어요. 먼저 카테고리를 추가하세요.'),
    proposal: (type: 'INCOME' | 'EXPENSE', amount: string, account: string, category: string) =>
      type === 'INCOME' ? `${account}(으)로 들어온 ${amount} 수입 초안이에요. 카테고리: ${category}. 확인하면 기록돼요.` : `${account}에서 나간 ${amount} 지출 초안이에요. 카테고리: ${category}. 확인하면 기록돼요.`,
    balancesIntro: (wallet: string) => `${wallet}의 잔액:`,
    noSpending: '이번 달에는 아직 지출이 없어요.',
    spendingIntro: (totals: string) => `이번 달에 ${totals}을(를) 썼어요.`,
    noBudgets: '이 지갑에는 진행 중인 예산이 없어요.',
    budgetsIntro: '진행 중인 예산:',
    budgetLine: (name: string, spent: string, amount: string, usage: number, over: boolean) =>
      `• ${name}: ${spent} / ${amount} (${usage}%)${over ? ' — 예산 초과' : ''}`,
    noGoals: '이 지갑에는 진행 중인 저축 목표가 없어요.',
    goalsIntro: '저축 목표:',
    goalLine: (name: string, current: string, target: string, progress: number) => `• ${name}: ${current} / ${target} (${progress}%)`,
  },
  ru: {
    help: 'Я могу записать расход или доход («Потратил 50k на обед со счёта Наличные») и ответить на вопросы о ваших балансах, расходах за этот месяц, бюджетах и целях.',
    viewerOnly: (wallet: string) => `У вас доступ к кошельку «${wallet}» только для просмотра, поэтому я не могу готовить там операции.`,
    walletArchived: (wallet: string) => `Кошелёк «${wallet}» в архиве, поэтому новые операции в нём не принимаются.`,
    noAccounts: 'В этом кошельке пока нет активных счетов. Сначала добавьте счёт.',
    whichAccount: (names: string[]) => `С какого счёта это было? В этом кошельке есть: ${names.join(', ')}.`,
    currencyMismatch: (account: string, currency: string, mentioned: string) => `Счёт «${account}» ведётся в ${currency}, поэтому я не могу записать на него ${mentioned}.`,
    noCategory: (type: 'INCOME' | 'EXPENSE') => (type === 'INCOME' ? 'В этом кошельке пока нет категорий доходов. Сначала добавьте категорию.' : 'В этом кошельке пока нет категорий расходов. Сначала добавьте категорию.'),
    proposal: (type: 'INCOME' | 'EXPENSE', amount: string, account: string, category: string) =>
      type === 'INCOME' ? `Вот черновик дохода ${amount} на счёт «${account}» в категории «${category}». Подтвердите, чтобы записать его.` : `Вот черновик расхода ${amount} со счёта «${account}» в категории «${category}». Подтвердите, чтобы записать его.`,
    balancesIntro: (wallet: string) => `Балансы в кошельке «${wallet}»:`,
    noSpending: 'В этом месяце расходов пока нет.',
    spendingIntro: (totals: string) => `В этом месяце вы потратили ${totals}.`,
    noBudgets: 'В этом кошельке нет активных бюджетов.',
    budgetsIntro: 'Ваши активные бюджеты:',
    budgetLine: (name: string, spent: string, amount: string, usage: number, over: boolean) =>
      `• ${name}: ${spent} / ${amount} (${usage}%)${over ? ' — сверх бюджета' : ''}`,
    noGoals: 'В этом кошельке нет активных целей накоплений.',
    goalsIntro: 'Ваши цели накоплений:',
    goalLine: (name: string, current: string, target: string, progress: number) => `• ${name}: ${current} / ${target} (${progress}%)`,
  },
  zh: {
    help: '我可以帮您记录一笔支出或收入（例如“午餐用现金花了 50k”），也能回答有关余额、本月支出、预算和储蓄目标的问题。',
    viewerOnly: (wallet: string) => `您对 ${wallet} 只有查看权限，所以我无法在其中准备交易。`,
    walletArchived: (wallet: string) => `${wallet} 已归档，不再接受新交易。`,
    noAccounts: '此钱包还没有活跃账户，请先添加一个。',
    whichAccount: (names: string[]) => `是哪个账户？此钱包有：${names.join(', ')}。`,
    currencyMismatch: (account: string, currency: string, mentioned: string) => `${account} 使用 ${currency}，所以我无法在其中记录 ${mentioned}。`,
    noCategory: (type: 'INCOME' | 'EXPENSE') => (type === 'INCOME' ? '此钱包还没有收入分类，请先添加一个。' : '此钱包还没有支出分类，请先添加一个。'),
    proposal: (type: 'INCOME' | 'EXPENSE', amount: string, account: string, category: string) =>
      type === 'INCOME' ? `这是一笔收入草稿：${amount} 计入 ${account}，分类为“${category}”。确认后即可记录。` : `这是一笔支出草稿：从 ${account} 支出 ${amount}，分类为“${category}”。确认后即可记录。`,
    balancesIntro: (wallet: string) => `${wallet} 的余额：`,
    noSpending: '本月还没有任何支出。',
    spendingIntro: (totals: string) => `您本月已支出 ${totals}。`,
    noBudgets: '此钱包没有进行中的预算。',
    budgetsIntro: '您进行中的预算：',
    budgetLine: (name: string, spent: string, amount: string, usage: number, over: boolean) =>
      `• ${name}：${spent} / ${amount}（${usage}%）${over ? ' — 已超支' : ''}`,
    noGoals: '此钱包没有进行中的储蓄目标。',
    goalsIntro: '您的储蓄目标：',
    goalLine: (name: string, current: string, target: string, progress: number) => `• ${name}：${current} / ${target}（${progress}%）`,
  },
} satisfies Record<Locale, unknown>;

// ---------------------------------------------------------------------------
// Mock Provider Class
// ---------------------------------------------------------------------------

/**
 * A deterministic stand-in for a real model: detects intent, groups
 * context from the toolbox, and answers deterministically. It exists so
 * the whole chat flow runs and is testable with no model or API key; every
 * figure it states comes from a tool, never from its own arithmetic.
 */
@Injectable()
export class MockLlmProvider implements LlmProvider {
  readonly name = 'mock';
  private readonly logger = new Logger(MockLlmProvider.name);

  async reply(request: LlmRequest): Promise<LlmReply> {
    this.logger.log(`[Detect Intent] Analyzing user message: "${request.message}" (locale: ${request.locale})`);
    const detected = detectUserIntent({
      message: request.message,
      locale: request.locale,
      history: request.history,
      now: request.now,
    });
    this.logger.log(
      `[Detected Intent] intent=${detected.intent} (confidence: ${(detected.confidence * 100).toFixed(0)}%) entities=${JSON.stringify(detected.entities, (_, v) => (typeof v === 'bigint' ? v.toString() : v))}`,
    );

    this.logger.log(`[Construct Prompt] Assembling deterministic context for intent: ${detected.intent}`);
    const context = await groupContextForAi(detected, request);

    this.logger.log(`[Execute Deterministic] Generating reply for intent: ${detected.intent}...`);
    const reply = await executeIntent(context, request);

    this.logger.log(
      `[Return Response] Content: "${reply.content}"${reply.proposal ? ` | Proposal: ${JSON.stringify(reply.proposal)}` : ''}`,
    );

    return reply;
  }
}
