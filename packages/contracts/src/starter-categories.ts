/**
 * The category tree a new wallet is seeded with (§5.1), grouped by type.
 *
 * Names must be unique across types, not just within one: `uq_category_name_per_parent`
 * is unique over (wallet_id, parent, LOWER(name)) and does **not** include `type`, which
 * is why the catch-alls are "Other Expense" and "Other Income" rather than two "Other"s.
 *
 * Shared between the server (`auth.service.ts`'s `seedWallet`) and the mobile
 * app's guest-mode local seed, so both produce an identical starting wallet.
 *
 * `names` is the single source of each starter category's translations. The
 * `category_translations` rows in `db/migrations/001_schema.sql` mirror it, and
 * `scripts/check-contract-parity.mjs` fails when the two disagree.
 */

import type { CategoryType, Locale } from './enums.ts';

export interface StarterCategory {
  /** Stable identity across wallets and locales, stored as `categories.system_key`. */
  key: string;
  /** `names.en` is also what the category row stores, so uniqueness and the fallback stay English. */
  names: Readonly<Record<Locale, string>>;
  type: CategoryType;
  icon: string;
  color: string;
}

export const STARTER_CATEGORIES: readonly StarterCategory[] = [
  { key: 'food', names: { en: 'Food', vi: 'Ăn uống' }, type: 'EXPENSE', icon: 'utensils', color: '#F97316' },
  { key: 'transportation', names: { en: 'Transportation', vi: 'Đi lại' }, type: 'EXPENSE', icon: 'bus', color: '#0EA5E9' },
  { key: 'shopping', names: { en: 'Shopping', vi: 'Mua sắm' }, type: 'EXPENSE', icon: 'shopping-bag', color: '#A855F7' },
  { key: 'bills', names: { en: 'Bills', vi: 'Hóa đơn' }, type: 'EXPENSE', icon: 'receipt', color: '#EF4444' },
  { key: 'housing', names: { en: 'Housing', vi: 'Nhà ở' }, type: 'EXPENSE', icon: 'home', color: '#8B5CF6' },
  { key: 'groceries', names: { en: 'Groceries', vi: 'Đi chợ' }, type: 'EXPENSE', icon: 'shopping-cart', color: '#F59E0B' },
  { key: 'health', names: { en: 'Health', vi: 'Sức khỏe' }, type: 'EXPENSE', icon: 'heart-pulse', color: '#F43F5E' },
  { key: 'entertainment', names: { en: 'Entertainment', vi: 'Giải trí' }, type: 'EXPENSE', icon: 'film', color: '#EC4899' },
  { key: 'education', names: { en: 'Education', vi: 'Giáo dục' }, type: 'EXPENSE', icon: 'graduation-cap', color: '#6366F1' },
  { key: 'travel', names: { en: 'Travel', vi: 'Du lịch' }, type: 'EXPENSE', icon: 'plane', color: '#14B8A6' },
  { key: 'subscriptions', names: { en: 'Subscriptions', vi: 'Gói đăng ký' }, type: 'EXPENSE', icon: 'repeat', color: '#8B5A2B' },
  { key: 'insurance', names: { en: 'Insurance', vi: 'Bảo hiểm' }, type: 'EXPENSE', icon: 'shield', color: '#475569' },
  { key: 'dining_out', names: { en: 'Dining Out', vi: 'Ăn ngoài' }, type: 'EXPENSE', icon: 'coffee', color: '#D97706' },
  { key: 'utilities', names: { en: 'Utilities', vi: 'Điện nước' }, type: 'EXPENSE', icon: 'zap', color: '#CA8A04' },
  { key: 'personal_care', names: { en: 'Personal Care', vi: 'Chăm sóc cá nhân' }, type: 'EXPENSE', icon: 'sparkles', color: '#DB2777' },
  { key: 'fitness', names: { en: 'Fitness', vi: 'Thể thao' }, type: 'EXPENSE', icon: 'dumbbell', color: '#0D9488' },
  { key: 'pets', names: { en: 'Pets', vi: 'Thú cưng' }, type: 'EXPENSE', icon: 'paw-print', color: '#B45309' },
  { key: 'repairs_maintenance', names: { en: 'Repairs & Maintenance', vi: 'Sửa chữa & bảo dưỡng' }, type: 'EXPENSE', icon: 'wrench', color: '#57534E' },
  { key: 'movies', names: { en: 'Movies', vi: 'Xem phim' }, type: 'EXPENSE', icon: 'clapperboard', color: '#BE185D' },
  { key: 'snacks', names: { en: 'Snacks', vi: 'Ăn vặt' }, type: 'EXPENSE', icon: 'cookie', color: '#C2410C' },
  { key: 'drinks', names: { en: 'Drinks', vi: 'Đồ uống' }, type: 'EXPENSE', icon: 'cup-soda', color: '#0891B2' },
  { key: 'fees', names: { en: 'Fees', vi: 'Phí' }, type: 'EXPENSE', icon: 'credit-card', color: '#7C3AED' },
  { key: 'other_expense', names: { en: 'Other Expense', vi: 'Chi khác' }, type: 'EXPENSE', icon: 'circle-ellipsis', color: '#64748B' },
  { key: 'salary', names: { en: 'Salary', vi: 'Lương' }, type: 'INCOME', icon: 'banknote', color: '#22C55E' },
  { key: 'freelance', names: { en: 'Freelance', vi: 'Làm tự do' }, type: 'INCOME', icon: 'briefcase', color: '#10B981' },
  { key: 'investment', names: { en: 'Investment', vi: 'Đầu tư' }, type: 'INCOME', icon: 'trending-up', color: '#059669' },
  { key: 'gift', names: { en: 'Gift', vi: 'Quà tặng' }, type: 'INCOME', icon: 'gift', color: '#84CC16' },
  { key: 'rental_income', names: { en: 'Rental Income', vi: 'Cho thuê' }, type: 'INCOME', icon: 'building-2', color: '#16A34A' },
  { key: 'interest', names: { en: 'Interest', vi: 'Tiền lãi' }, type: 'INCOME', icon: 'percent', color: '#15803D' },
  { key: 'bonus', names: { en: 'Bonus', vi: 'Thưởng' }, type: 'INCOME', icon: 'award', color: '#65A30D' },
  { key: 'refund', names: { en: 'Refund', vi: 'Hoàn tiền' }, type: 'INCOME', icon: 'undo-2', color: '#4D7C0F' },
  { key: 'part_time', names: { en: 'Part Time', vi: 'Làm thêm' }, type: 'INCOME', icon: 'clock', color: '#0D9488' },
  { key: 'other_income', names: { en: 'Other Income', vi: 'Thu khác' }, type: 'INCOME', icon: 'hand-coins', color: '#A16207' },
  { key: 'savings', names: { en: 'Savings', vi: 'Tiết kiệm' }, type: 'TRANSFER', icon: 'piggy-bank', color: '#0EA5E9' },
  { key: 'debt_repayment', names: { en: 'Debt Repayment', vi: 'Trả nợ' }, type: 'TRANSFER', icon: 'handshake', color: '#6366F1' },
  { key: 'credit_card_payment', names: { en: 'Credit Card Payment', vi: 'Thanh toán thẻ tín dụng' }, type: 'TRANSFER', icon: 'credit-card', color: '#64748B' },
  { key: 'top_up', names: { en: 'Top Up', vi: 'Nạp tiền' }, type: 'TRANSFER', icon: 'wallet', color: '#14B8A6' },
  { key: 'cash_withdrawal', names: { en: 'Cash Withdrawal', vi: 'Rút tiền mặt' }, type: 'TRANSFER', icon: 'landmark', color: '#78716C' },
];

/** The default wallet a new account gets, named in the language chosen at sign-up (API spec §5.1). */
export function starterWalletName(displayName: string, locale: Locale): string {
  return locale === 'vi' ? `Ví của ${displayName}` : `${displayName}'s Wallet`;
}

/** The default CASH account seeded into a new wallet. */
export const STARTER_CASH_ACCOUNT_NAME: Readonly<Record<Locale, string>> = { en: 'Cash', vi: 'Tiền mặt' };

const STARTER_BY_KEY = new Map(STARTER_CATEGORIES.map((category) => [category.key, category]));

/**
 * The name a category shows in `locale`: a starter category's translation, falling back to
 * English, or a custom category's own text exactly as its author typed it.
 */
export function localizedCategoryName(category: { name: string; systemKey: string | null }, locale: Locale): string {
  if (category.systemKey === null) return category.name;
  const starter = STARTER_BY_KEY.get(category.systemKey);
  return starter?.names[locale] ?? starter?.names.en ?? category.name;
}
