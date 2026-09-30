import { Injectable } from '@nestjs/common';
import {
  aiTransactionDraftSchema,
  formatMoney,
  formatMoneyCompact,
  MoneyError,
  parseMoney,
  REQUIRED_ROLE,
  roleSatisfies,
  WalletStatus,
  type CurrencyTotal,
  type Locale,
  TransactionType,
} from '@sora/contracts';

import type { LlmProvider, LlmReply, LlmRequest, WalletSnapshot } from './llm-provider.ts';

/**
 * A deterministic stand-in for a real model: keyword rules over the message,
 * answered from the toolbox. It exists so the whole chat flow runs and is
 * testable with no model or API key; every figure it states comes from a tool,
 * never from its own arithmetic.
 */
@Injectable()
export class MockLlmProvider implements LlmProvider {
  readonly name = 'mock';

  async reply(request: LlmRequest): Promise<LlmReply> {
    const text = normalize(request.message);
    const copy = COPY[request.locale];
    const amount = parseAmount(request.message);
    const direction = hasAny(text, INCOME_WORDS) ? TransactionType.INCOME : hasAny(text, EXPENSE_WORDS) ? TransactionType.EXPENSE : null;

    // "How much did I spend in 2025?" names a number but asks rather than records.
    const isQuestion = request.message.includes('?') || hasAny(text, QUESTION_WORDS);
    if (amount !== null && direction !== null && !isQuestion) {
      return this.proposeTransaction(request, direction, amount);
    }
    if (hasAny(text, BUDGET_WORDS)) return { content: await this.budgets(request) };
    if (hasAny(text, GOAL_WORDS)) return { content: await this.goals(request) };
    if (hasAny(text, BALANCE_WORDS)) return { content: await this.balances(request) };
    if (hasAny(text, SPENDING_WORDS)) return { content: await this.spending(request) };
    return { content: copy.help };
  }

  private async proposeTransaction(request: LlmRequest, type: 'INCOME' | 'EXPENSE', amount: bigint): Promise<LlmReply> {
    const copy = COPY[request.locale];
    const snapshot = await request.toolbox.walletSnapshot();
    const text = normalize(request.message);

    if (!roleSatisfies(snapshot.role, REQUIRED_ROLE.WRITE)) return { content: copy.viewerOnly(snapshot.walletName) };
    if (snapshot.status !== WalletStatus.ACTIVE) return { content: copy.walletArchived(snapshot.walletName) };
    if (snapshot.accounts.length === 0) return { content: copy.noAccounts };

    const account =
      longestNameMatch(text, snapshot.accounts) ?? (snapshot.accounts.length === 1 ? snapshot.accounts[0] : undefined);
    if (account === undefined) {
      return { content: copy.whichAccount(snapshot.accounts.map((item) => item.name)) };
    }

    // BR-07: an account holds one currency, and nothing here converts between them.
    const mentioned = mentionedCurrency(request.message);
    if (mentioned !== null && mentioned !== account.currency) {
      return { content: copy.currencyMismatch(account.name, account.currency, mentioned) };
    }

    const category = pickCategory(text, snapshot, type);
    if (category === undefined) return { content: copy.noCategory(type) };

    const transaction = aiTransactionDraftSchema.parse({
      type,
      ...(type === TransactionType.EXPENSE ? { fromAccountId: account.id } : { toAccountId: account.id }),
      categoryId: category.id,
      amount: formatMoney(amount),
      currency: account.currency,
      description: request.message.trim().slice(0, 200),
      transactionDate: request.now.toISOString(),
    });

    return {
      content: copy.proposal(type, displayAmount(transaction.amount, account.currency, request.locale), account.name, category.name),
      proposal: { transaction, accountName: account.name, categoryName: category.name },
    };
  }

  private async balances(request: LlmRequest): Promise<string> {
    const copy = COPY[request.locale];
    const snapshot = await request.toolbox.walletSnapshot();
    if (snapshot.accounts.length === 0) return copy.noAccounts;
    const lines = snapshot.accounts.map(
      (account) => `• ${account.name}: ${displayAmount(account.balance, account.currency, request.locale)}`,
    );
    return `${copy.balancesIntro(snapshot.walletName)}\n${lines.join('\n')}`;
  }

  private async spending(request: LlmRequest): Promise<string> {
    const copy = COPY[request.locale];
    const summary = await request.toolbox.monthSummary();
    if (summary.expense.length === 0) return copy.noSpending;

    const totals = joinTotals(summary.expense, request.locale);
    const top = summary.spendingByCategory
      .slice(0, 3)
      .map((slice) => `• ${slice.categoryName}: ${slice.percentage}%`)
      .join('\n');
    return top.length > 0 ? `${copy.spendingIntro(totals)}\n${top}` : copy.spendingIntro(totals);
  }

  private async budgets(request: LlmRequest): Promise<string> {
    const copy = COPY[request.locale];
    const summary = await request.toolbox.monthSummary();
    if (summary.activeBudgets.length === 0) return copy.noBudgets;
    const lines = summary.activeBudgets.map((budget) =>
      copy.budgetLine(
        budget.name,
        displayAmount(budget.spent, budget.currency, request.locale),
        displayAmount(budget.amount, budget.currency, request.locale),
        budget.usagePercentage,
        budget.isOverBudget,
      ),
    );
    return `${copy.budgetsIntro}\n${lines.join('\n')}`;
  }

  private async goals(request: LlmRequest): Promise<string> {
    const copy = COPY[request.locale];
    const summary = await request.toolbox.monthSummary();
    if (summary.activeGoals.length === 0) return copy.noGoals;
    const lines = summary.activeGoals.map((goal) =>
      copy.goalLine(
        goal.name,
        displayAmount(goal.currentAmount, goal.currency, request.locale),
        displayAmount(goal.targetAmount, goal.currency, request.locale),
        goal.progressPercentage,
      ),
    );
    return `${copy.goalsIntro}\n${lines.join('\n')}`;
  }
}

// ---------------------------------------------------------------------------
// Parsing
// ---------------------------------------------------------------------------

/** Lowercase with diacritics removed, so "Số dư" and "so du" match the same rule. */
export function normalize(input: string): string {
  return input.normalize('NFD').replace(/\p{M}/gu, '').replace(/đ/g, 'd').replace(/Đ/g, 'd').toLowerCase();
}

function hasAny(text: string, phrases: readonly string[]): boolean {
  return phrases.some((phrase) => containsPhrase(text, phrase));
}

function containsPhrase(text: string, phrase: string): boolean {
  const escaped = phrase.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return new RegExp(`(^|[^a-z0-9])${escaped}($|[^a-z0-9])`).test(text);
}

const MULTIPLIERS: Record<string, bigint> = { k: 1_000n, nghin: 1_000n, ngan: 1_000n, tr: 1_000_000n, trieu: 1_000_000n, m: 1_000_000n, million: 1_000_000n };

/**
 * The first amount in the message as scaled minor units: "50k", "1.5tr",
 * "65,000", "65.000", "12.50". A 3-digit group after a separator is read as
 * thousands; anything else after one is a decimal part.
 */
export function parseAmount(message: string): bigint | null {
  const match = normalize(message).match(
    /(\d{1,3}(?:[.,]\d{3})+|\d+(?:[.,]\d{1,4})?)\s*(million|trieu|nghin|ngan|tr|k|m)?(?![a-z])/,
  );
  if (!match) return null;

  const [, digits, suffix] = match;
  const decimal = /^\d{1,3}(?:[.,]\d{3})+$/.test(digits!) && suffix === undefined ? digits!.replace(/[.,]/g, '') : digits!.replace(',', '.');
  try {
    const value = parseMoney(decimal) * (suffix ? MULTIPLIERS[suffix]! : 1n);
    return value > 0n ? value : null;
  } catch (error) {
    if (error instanceof MoneyError) return null;
    throw error;
  }
}

const CURRENCY_CODES = ['USD', 'VND', 'EUR', 'JPY', 'GBP', 'AUD', 'SGD', 'KRW', 'CNY', 'THB'];

function mentionedCurrency(message: string): string | null {
  const code = message.toUpperCase().match(new RegExp(`(^|[^A-Z])(${CURRENCY_CODES.join('|')})($|[^A-Z])`));
  if (code) return code[2]!;
  if (message.includes('$')) return 'USD';
  if (/₫|\d\s*đ(?![a-zà-ỹ])/i.test(message) || containsPhrase(normalize(message), 'dong')) return 'VND';
  return null;
}

function longestNameMatch<T extends { name: string }>(text: string, items: readonly T[]): T | undefined {
  return items
    .filter((item) => containsPhrase(text, normalize(item.name)))
    .sort((a, b) => b.name.length - a.name.length)[0];
}

/** Everyday words mapped to the starter category names they usually mean. */
const CATEGORY_HINTS: { words: string[]; categories: string[] }[] = [
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

function pickCategory(text: string, snapshot: WalletSnapshot, type: TransactionType) {
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

const EXPENSE_WORDS = ['spent', 'spend', 'paid', 'pay', 'bought', 'buy', 'cost', 'chi', 'tieu', 'mua', 'tra', 'het'];
const INCOME_WORDS = ['received', 'receive', 'earned', 'earn', 'got paid', 'salary', 'income', 'nhan', 'luong', 'thuong', 'bonus'];
const BALANCE_WORDS = ['balance', 'balances', 'how much do i have', 'so du', 'con bao nhieu'];
const BUDGET_WORDS = ['budget', 'budgets', 'ngan sach'];
const GOAL_WORDS = ['goal', 'goals', 'saving', 'savings', 'muc tieu', 'tiet kiem'];
const QUESTION_WORDS = ['how much', 'how many', 'what', 'bao nhieu', 'khong'];
const SPENDING_WORDS =['spend', 'spent', 'spending', 'expense', 'expenses', 'chi tieu'];

// ---------------------------------------------------------------------------
// Copy
// ---------------------------------------------------------------------------

function displayAmount(amount: string, currency: string, locale: Locale): string {
  const compact = formatMoneyCompact(parseMoney(amount));
  const negative = compact.startsWith('-');
  const [whole, fraction] = (negative ? compact.slice(1) : compact).split('.');
  const group = locale === 'vi' ? '.' : ',';
  const decimal = locale === 'vi' ? ',' : '.';
  const grouped = whole!.replace(/\B(?=(\d{3})+(?!\d))/g, group);
  return `${negative ? '-' : ''}${grouped}${fraction ? decimal + fraction : ''} ${currency}`;
}

function joinTotals(totals: CurrencyTotal[], locale: Locale): string {
  // BR-07: one figure per currency, never summed across them.
  return totals.map((total) => displayAmount(total.amount, total.currency, locale)).join(' + ');
}

const COPY = {
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
} satisfies Record<Locale, unknown>;
