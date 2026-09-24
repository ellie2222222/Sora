/**
 * The category tree a new wallet is seeded with (§5.1), grouped by type.
 *
 * Names must be unique across types, not just within one: `uq_category_name_per_parent`
 * is unique over (wallet_id, parent, LOWER(name)) and does **not** include `type`, which
 * is why the catch-alls are "Other Expense" and "Other Income" rather than two "Other"s.
 *
 * Shared between the server (`auth.service.ts`'s `seedWallet`) and the mobile
 * app's guest-mode local seed, so both produce an identical starting wallet.
 */

import type { CategoryType } from './enums.ts';

export interface StarterCategory {
  name: string;
  type: CategoryType;
  icon: string;
  color: string;
}

export const STARTER_CATEGORIES: readonly StarterCategory[] = [
  { name: 'Food', type: 'EXPENSE', icon: 'utensils', color: '#F97316' },
  { name: 'Transportation', type: 'EXPENSE', icon: 'bus', color: '#0EA5E9' },
  { name: 'Shopping', type: 'EXPENSE', icon: 'shopping-bag', color: '#A855F7' },
  { name: 'Bills', type: 'EXPENSE', icon: 'receipt', color: '#EF4444' },
  { name: 'Housing', type: 'EXPENSE', icon: 'home', color: '#8B5CF6' },
  { name: 'Groceries', type: 'EXPENSE', icon: 'shopping-cart', color: '#F59E0B' },
  { name: 'Health', type: 'EXPENSE', icon: 'heart-pulse', color: '#F43F5E' },
  { name: 'Entertainment', type: 'EXPENSE', icon: 'film', color: '#EC4899' },
  { name: 'Education', type: 'EXPENSE', icon: 'graduation-cap', color: '#6366F1' },
  { name: 'Travel', type: 'EXPENSE', icon: 'plane', color: '#14B8A6' },
  { name: 'Subscriptions', type: 'EXPENSE', icon: 'repeat', color: '#8B5A2B' },
  { name: 'Insurance', type: 'EXPENSE', icon: 'shield', color: '#475569' },
  { name: 'Dining Out', type: 'EXPENSE', icon: 'coffee', color: '#D97706' },
  { name: 'Utilities', type: 'EXPENSE', icon: 'zap', color: '#CA8A04' },
  { name: 'Personal Care', type: 'EXPENSE', icon: 'sparkles', color: '#DB2777' },
  { name: 'Fitness', type: 'EXPENSE', icon: 'dumbbell', color: '#0D9488' },
  { name: 'Pets', type: 'EXPENSE', icon: 'paw-print', color: '#B45309' },
  { name: 'Repairs & Maintenance', type: 'EXPENSE', icon: 'wrench', color: '#57534E' },
  { name: 'Movies', type: 'EXPENSE', icon: 'clapperboard', color: '#BE185D' },
  { name: 'Snacks', type: 'EXPENSE', icon: 'cookie', color: '#C2410C' },
  { name: 'Drinks', type: 'EXPENSE', icon: 'cup-soda', color: '#0891B2' },
  { name: 'Fees', type: 'EXPENSE', icon: 'credit-card', color: '#7C3AED' },
  { name: 'Other Expense', type: 'EXPENSE', icon: 'circle-ellipsis', color: '#64748B' },
  { name: 'Salary', type: 'INCOME', icon: 'banknote', color: '#22C55E' },
  { name: 'Freelance', type: 'INCOME', icon: 'briefcase', color: '#10B981' },
  { name: 'Investment', type: 'INCOME', icon: 'trending-up', color: '#059669' },
  { name: 'Gift', type: 'INCOME', icon: 'gift', color: '#84CC16' },
  { name: 'Rental Income', type: 'INCOME', icon: 'building-2', color: '#16A34A' },
  { name: 'Interest', type: 'INCOME', icon: 'percent', color: '#15803D' },
  { name: 'Bonus', type: 'INCOME', icon: 'award', color: '#65A30D' },
  { name: 'Refund', type: 'INCOME', icon: 'undo-2', color: '#4D7C0F' },
  { name: 'Part Time', type: 'INCOME', icon: 'clock', color: '#0D9488' },
  { name: 'Other Income', type: 'INCOME', icon: 'hand-coins', color: '#A16207' },
  { name: 'Savings', type: 'TRANSFER', icon: 'piggy-bank', color: '#0EA5E9' },
  { name: 'Debt Repayment', type: 'TRANSFER', icon: 'handshake', color: '#6366F1' },
  { name: 'Credit Card Payment', type: 'TRANSFER', icon: 'credit-card', color: '#64748B' },
  { name: 'Top Up', type: 'TRANSFER', icon: 'wallet', color: '#14B8A6' },
  { name: 'Cash Withdrawal', type: 'TRANSFER', icon: 'landmark', color: '#78716C' },
];
