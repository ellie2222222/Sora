/**
 * The category tree a new wallet is seeded with (§5.1).
 *
 * "Other" is EXPENSE-typed and appears once: `uq_category_name_per_parent` is
 * unique over (wallet_id, parent, LOWER(name)) and does **not** include `type`,
 * so an "Other" under both INCOME and EXPENSE would be rejected by the database
 * rather than by anything in this file.
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
  { name: 'Salary', type: 'INCOME', icon: 'banknote', color: '#22C55E' },
  { name: 'Other', type: 'EXPENSE', icon: 'circle-ellipsis', color: '#64748B' },
];
