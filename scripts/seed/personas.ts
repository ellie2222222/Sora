// Declarative story data: plan §2–§4 and §6. Everything here is written once and read by the generators,
// the poster and verify, so a figure changed in one place moves everywhere.

import type { AccountType, BudgetPeriodType, CategoryType, GoalStatus, Locale } from '@sora/contracts';

import { HOME_ZONE, addDays, addMonths, type StoryDates } from './calendar.ts';

export type PersonaKey = 'an' | 'linh' | 'khoa' | 'bao';
export type WalletKey = 'an' | 'linh' | 'khoa' | 'bao' | 'mom' | 'house';

export interface Persona {
  key: PersonaKey;
  displayName: string;
  locale: Locale;
  baseCurrency: string;
  timeZone: string;
}

export const PERSONAS: Record<PersonaKey, Persona> = {
  an: { key: 'an', displayName: 'An', locale: 'vi', baseCurrency: 'VND', timeZone: HOME_ZONE },
  linh: { key: 'linh', displayName: 'Linh', locale: 'en', baseCurrency: 'VND', timeZone: HOME_ZONE },
  khoa: { key: 'khoa', displayName: 'Khoa', locale: 'vi', baseCurrency: 'VND', timeZone: HOME_ZONE },
  bao: { key: 'bao', displayName: 'Bao', locale: 'vi', baseCurrency: 'AUD', timeZone: 'Australia/Melbourne' },
};

export const PERSONA_KEYS = Object.keys(PERSONAS) as PersonaKey[];

export interface WalletDef {
  key: WalletKey;
  owner: PersonaKey;
  /** Set for wallets the seed creates; a registration's own wallet is named by the server. */
  name: string | null;
  timeZone: string;
}

export const WALLETS: Record<WalletKey, WalletDef> = {
  an: { key: 'an', owner: 'an', name: null, timeZone: HOME_ZONE },
  linh: { key: 'linh', owner: 'linh', name: null, timeZone: HOME_ZONE },
  khoa: { key: 'khoa', owner: 'khoa', name: null, timeZone: HOME_ZONE },
  bao: { key: 'bao', owner: 'bao', name: null, timeZone: 'Australia/Melbourne' },
  mom: { key: 'mom', owner: 'an', name: "Mom's Wallet", timeZone: HOME_ZONE },
  house: { key: 'house', owner: 'an', name: 'Shared House', timeZone: HOME_ZONE },
};

export interface MembershipDef {
  wallet: WalletKey;
  invitee: PersonaKey | 'sister';
  role: 'EDITOR' | 'VIEWER';
  relationLabel: string;
}

/** The inviter's own word for the invitee (SRS FR-11). The sister's invitation stays open. */
export const MEMBERSHIPS: MembershipDef[] = [
  { wallet: 'an', invitee: 'linh', role: 'VIEWER', relationLabel: 'Girlfriend' },
  { wallet: 'mom', invitee: 'bao', role: 'VIEWER', relationLabel: 'Brother' },
  { wallet: 'house', invitee: 'khoa', role: 'EDITOR', relationLabel: 'Friend' },
  { wallet: 'mom', invitee: 'sister', role: 'EDITOR', relationLabel: 'Sister' },
  { wallet: 'linh', invitee: 'an', role: 'EDITOR', relationLabel: 'Boyfriend' },
];

export type AccountKey =
  | 'vcb' | 'tcb' | 'cash' | 'momo' | 'visa' | 'wise' | 'jpy' | 'acb'
  | 'bidv' | 'lsave' | 'lcash' | 'zalo'
  | 'mcash' | 'agri'
  | 'kitty'
  | 'kbank' | 'kcash'
  | 'cba' | 'bcash';

export interface AccountDef {
  key: AccountKey;
  wallet: WalletKey;
  /** Null for the Cash account registration seeds, named in the owner's locale. */
  name: string | null;
  type: AccountType;
  currency: string;
  opening: string;
}

export const ACCOUNTS: Record<AccountKey, AccountDef> = {
  vcb: { key: 'vcb', wallet: 'an', name: 'Vietcombank', type: 'BANK_ACCOUNT', currency: 'VND', opening: '65000000' },
  tcb: { key: 'tcb', wallet: 'an', name: 'Techcombank Savings', type: 'BANK_ACCOUNT', currency: 'VND', opening: '45000000' },
  cash: { key: 'cash', wallet: 'an', name: null, type: 'CASH', currency: 'VND', opening: '0' },
  momo: { key: 'momo', wallet: 'an', name: 'MoMo', type: 'E_WALLET', currency: 'VND', opening: '350000' },
  visa: { key: 'visa', wallet: 'an', name: 'VIB Visa', type: 'CREDIT_CARD', currency: 'VND', opening: '-2450000' },
  wise: { key: 'wise', wallet: 'an', name: 'Wise USD', type: 'BANK_ACCOUNT', currency: 'USD', opening: '320.50' },
  jpy: { key: 'jpy', wallet: 'an', name: 'Japan Cash', type: 'CASH', currency: 'JPY', opening: '80000' },
  acb: { key: 'acb', wallet: 'an', name: 'ACB (old)', type: 'BANK_ACCOUNT', currency: 'VND', opening: '3180000' },
  bidv: { key: 'bidv', wallet: 'linh', name: 'BIDV', type: 'BANK_ACCOUNT', currency: 'VND', opening: '9800000' },
  lsave: { key: 'lsave', wallet: 'linh', name: 'BIDV Savings', type: 'BANK_ACCOUNT', currency: 'VND', opening: '0' },
  lcash: { key: 'lcash', wallet: 'linh', name: null, type: 'CASH', currency: 'VND', opening: '0' },
  zalo: { key: 'zalo', wallet: 'linh', name: 'ZaloPay', type: 'E_WALLET', currency: 'VND', opening: '150000' },
  mcash: { key: 'mcash', wallet: 'mom', name: "Mom's Cash", type: 'CASH', currency: 'VND', opening: '4000000' },
  agri: { key: 'agri', wallet: 'mom', name: 'Agribank', type: 'BANK_ACCOUNT', currency: 'VND', opening: '120000000' },
  kitty: { key: 'kitty', wallet: 'house', name: 'House Kitty', type: 'CASH', currency: 'VND', opening: '0' },
  kbank: { key: 'kbank', wallet: 'khoa', name: 'MB Bank', type: 'BANK_ACCOUNT', currency: 'VND', opening: '40000000' },
  kcash: { key: 'kcash', wallet: 'khoa', name: null, type: 'CASH', currency: 'VND', opening: '0' },
  cba: { key: 'cba', wallet: 'bao', name: 'CommBank', type: 'BANK_ACCOUNT', currency: 'AUD', opening: '2400.00' },
  bcash: { key: 'bcash', wallet: 'bao', name: null, type: 'CASH', currency: 'AUD', opening: '0' },
};

export const walletOfAccount = (account: AccountKey): WalletDef => WALLETS[ACCOUNTS[account].wallet];

/**
 * A cash or e-wallet balance that would fall below `threshold` is topped up from `source` earlier the
 * same day, by `max(minimum, spend + threshold)` rounded up to `step` (plan §5.2).
 */
export interface RefillRule {
  source: AccountKey;
  threshold: number;
  minimum: number;
  step: number;
  category: string;
  description: string;
}

export const REFILLS: Partial<Record<AccountKey, RefillRule>> = {
  cash: { source: 'vcb', threshold: 300_000, minimum: 1_000_000, step: 100_000, category: 'cash_withdrawal', description: 'Rút tiền ATM' },
  momo: { source: 'vcb', threshold: 100_000, minimum: 300_000, step: 100_000, category: 'top_up', description: 'Nạp MoMo' },
  lcash: { source: 'bidv', threshold: 300_000, minimum: 1_000_000, step: 100_000, category: 'cash_withdrawal', description: 'ATM withdrawal' },
  zalo: { source: 'bidv', threshold: 100_000, minimum: 300_000, step: 100_000, category: 'top_up', description: 'ZaloPay top-up' },
  bcash: { source: 'cba', threshold: 20, minimum: 100, step: 10, category: 'cash_withdrawal', description: 'Rút tiền ATM' },
};

export interface CategoryDef {
  key: string;
  wallet: WalletKey;
  name: string;
  type: CategoryType;
  /** A starter key or another custom key in the same wallet. */
  parent: string | null;
  icon: string;
}

const custom = (wallet: WalletKey, rows: [string, string, CategoryType, string | null, string][]): CategoryDef[] =>
  rows.map(([key, name, type, parent, icon]) => ({ key, wallet, name, type, parent, icon }));

/** Wallets registration created hold the 38 starters, found by systemKey; these are the seed's own. */
export const CUSTOM_CATEGORIES: CategoryDef[] = [
  ...custom('an', [
    ['rent', 'Rent', 'EXPENSE', 'housing', 'home'],
    ['grab', 'Grab', 'EXPENSE', 'transportation', 'bus'],
    ['fuel', 'Fuel', 'EXPENSE', 'transportation', 'zap'],
    ['coffee', 'Coffee', 'EXPENSE', 'dining_out', 'coffee'],
    ['electronics', 'Electronics', 'EXPENSE', 'shopping', 'shopping-bag'],
    ['family_support', 'Family Support', 'EXPENSE', null, 'heart-pulse'],
    ['wedding_gifts', 'Wedding Gifts', 'EXPENSE', null, 'gift'],
    ['phone_internet', 'Phone & Internet', 'EXPENSE', null, 'zap'],
    ['lucky_money', 'Lucky Money', 'INCOME', null, 'hand-coins'],
    ['lucky_money_given', 'Lucky Money Given', 'EXPENSE', null, 'gift'],
    ['side_project', 'Side Project', 'INCOME', 'freelance', 'briefcase'],
    ['allowance_to_mom', 'Allowance to Mom', 'TRANSFER', null, 'handshake'],
    ['settle_up', 'Settle Up', 'TRANSFER', null, 'handshake'],
    ['house_share', 'House Share', 'TRANSFER', null, 'home'],
    ['gym', 'Gym Membership', 'EXPENSE', 'fitness', 'dumbbell'],
  ]),
  ...custom('mom', [
    ['market', 'Market', 'EXPENSE', null, 'shopping-cart'],
    ['medicine', 'Medicine', 'EXPENSE', null, 'heart-pulse'],
    ['temple_offering', 'Temple Offering', 'EXPENSE', null, 'sparkles'],
    ['electricity_water', 'Electricity & Water', 'EXPENSE', null, 'zap'],
    ['gifts_for_grandkids', 'Gifts for Grandkids', 'EXPENSE', null, 'gift'],
    ['phone', 'Phone', 'EXPENSE', null, 'receipt'],
    ['other_expense', 'Other Expense', 'EXPENSE', null, 'circle-ellipsis'],
    ['pension', 'Pension', 'INCOME', null, 'banknote'],
    ['allowance_from_children', 'Allowance from Children', 'INCOME', null, 'hand-coins'],
    ['interest', 'Interest', 'INCOME', null, 'percent'],
    ['other_income', 'Other Income', 'INCOME', null, 'circle-ellipsis'],
    ['savings', 'Savings', 'TRANSFER', null, 'piggy-bank'],
  ]),
  ...custom('house', [
    ['rent', 'Rent', 'EXPENSE', null, 'home'],
    ['utilities', 'Utilities', 'EXPENSE', null, 'zap'],
    ['groceries', 'Groceries', 'EXPENSE', null, 'shopping-cart'],
    ['cleaning', 'Cleaning', 'EXPENSE', null, 'sparkles'],
    ['contribution', 'Contribution', 'INCOME', null, 'hand-coins'],
    ['other', 'Other', 'EXPENSE', null, 'circle-ellipsis'],
  ]),
];

/** Wallets whose categories registration seeded (starter keys resolve there). */
export const STARTER_WALLETS: WalletKey[] = ['an', 'linh', 'khoa', 'bao'];

export type GoalKey = 'emergency' | 'japan' | 'macbook' | 'motorbike' | 'guitar' | 'wedding' | 'laptop' | 'anniversary' | 'health';

export interface GoalDef {
  key: GoalKey;
  wallet: WalletKey;
  name: string;
  target: string;
  currency: string;
  targetDate: (dates: StoryDates) => string | null;
  /** The status phase 6 leaves it in; contributions all land while it is still ACTIVE. */
  end: GoalStatus;
}

/** In creation order: Wedding Fund last, so it lists first (`GET /goals` is newest first). */
export const GOALS: GoalDef[] = [
  { key: 'emergency', wallet: 'an', name: 'Emergency Fund', target: '60000000', currency: 'VND', targetDate: () => null, end: 'ACTIVE' },
  { key: 'japan', wallet: 'an', name: 'Japan Trip', target: '45000000', currency: 'VND', targetDate: (d) => d.japan.returns, end: 'ACTIVE' },
  { key: 'macbook', wallet: 'an', name: 'MacBook Pro', target: '1999.00', currency: 'USD', targetDate: (d) => addMonths(d.anchor, 1), end: 'ACTIVE' },
  { key: 'motorbike', wallet: 'an', name: 'New Motorbike', target: '35000000', currency: 'VND', targetDate: (d) => addMonths(d.anchor, -4), end: 'COMPLETED' },
  { key: 'guitar', wallet: 'an', name: 'Learn Guitar', target: '8000000', currency: 'VND', targetDate: () => null, end: 'CANCELLED' },
  { key: 'laptop', wallet: 'an', name: 'Laptop Repair', target: '5000000', currency: 'VND', targetDate: (d) => addMonths(d.anchor, -1), end: 'ACTIVE' },
  { key: 'anniversary', wallet: 'linh', name: 'Anniversary Trip', target: '20000000', currency: 'VND', targetDate: (d) => addMonths(d.anchor, 3), end: 'ACTIVE' },
  { key: 'health', wallet: 'mom', name: 'Health Check-up', target: '6000000', currency: 'VND', targetDate: (d) => addMonths(d.anchor, 1), end: 'ACTIVE' },
  { key: 'wedding', wallet: 'an', name: 'Wedding Fund', target: '150000000', currency: 'VND', targetDate: (d) => addMonths(d.anchor, 24), end: 'ACTIVE' },
];

export interface BudgetDef {
  key: string;
  wallet: WalletKey;
  name: string;
  amount: string;
  currency: string;
  periodType: BudgetPeriodType;
  start: (dates: StoryDates) => string;
  end: (dates: StoryDates) => string | null;
  category: string | null;
  goal: GoalKey | null;
}

const repeating = (
  key: string,
  wallet: WalletKey,
  name: string,
  amount: string,
  currency: string,
  periodType: BudgetPeriodType,
  start: (dates: StoryDates) => string,
  category: string | null,
): BudgetDef => ({ key, wallet, name, amount, currency, periodType, start, end: () => null, category, goal: null });

export const BUDGETS: BudgetDef[] = [
  repeating('food', 'an', 'Food', '3000000', 'VND', 'MONTHLY', (d) => d.historyStart, 'food'),
  repeating('weekendDining', 'an', 'Weekend Dining', '700000', 'VND', 'WEEKLY', (d) => d.firstMonday, 'dining_out'),
  repeating('coffee', 'an', 'Coffee', '60000', 'VND', 'DAILY', (d) => d.historyStart, 'coffee'),
  repeating('bills', 'an', 'Bills', '1500000', 'VND', 'MONTHLY', (d) => d.billsStart, 'utilities'),
  repeating('housing', 'an', 'Housing', '7000000', 'VND', 'MONTHLY', (d) => d.historyStart, 'housing'),
  repeating('travel', 'an', 'Travel', '65000000', 'VND', 'YEARLY', (d) => d.yearlyStart, 'travel'),
  repeating('courses', 'an', 'Online Courses', '300.00', 'USD', 'YEARLY', (d) => d.yearlyStart, 'education'),
  {
    key: 'sale', wallet: 'an', name: '11.11 Sale', amount: '6000000', currency: 'VND', periodType: 'CUSTOM',
    start: (d) => d.sale.start, end: (d) => d.sale.end, category: 'shopping', goal: null,
  },
  {
    key: 'nextTet', wallet: 'an', name: 'Next Tet', amount: '4000000', currency: 'VND', periodType: 'CUSTOM',
    start: (d) => addDays(d.nextTet, -29), end: (d) => d.nextTet, category: 'lucky_money_given', goal: null,
  },
  {
    key: 'japanTrip', wallet: 'an', name: 'Japan Trip', amount: '30000000', currency: 'VND', periodType: 'GOAL',
    start: (d) => addDays(d.anchor, -70), end: (d) => d.japan.returns, category: null, goal: 'japan',
  },
  repeating('cap', 'an', 'Monthly Cap', '27000000', 'VND', 'MONTHLY', (d) => d.historyStart, null),
  repeating('linhGroceries', 'linh', 'Groceries', '3500000', 'VND', 'MONTHLY', (d) => d.historyStart, 'groceries'),
  repeating('linhEverything', 'linh', 'Everything', '1000000', 'VND', 'WEEKLY', (d) => d.firstMonday, null),
  repeating('momMarket', 'mom', 'Market', '5500000', 'VND', 'MONTHLY', (d) => d.historyStart, 'market'),
  repeating('momDaily', 'mom', 'Daily Spending', '200000', 'VND', 'DAILY', (d) => d.historyStart, null),
  repeating('baoGroceries', 'bao', 'Groceries', '60.00', 'AUD', 'WEEKLY', (d) => d.firstMonday, 'groceries'),
];
