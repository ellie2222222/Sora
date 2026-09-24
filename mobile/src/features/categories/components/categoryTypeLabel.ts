import type { CategoryType } from '@sora/contracts';

/** Translated per-type label, so the enum's English spelling never leaks into a translated sentence. */
export const CATEGORY_TYPE_LABEL_KEY = {
  EXPENSE: 'categories.expense',
  INCOME: 'categories.income',
  TRANSFER: 'categories.transfer',
} as const satisfies Record<CategoryType, string>;
