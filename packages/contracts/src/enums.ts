/**
 * Domain enumerations.
 *
 * Every member string is byte-identical to the value the corresponding CHECK
 * constraint in db/migrations/001_initial_wallet_schema.sql allows. A mismatch
 * here surfaces as a 500 from Postgres rather than a validation error, so
 * scripts/check-contract-parity.mjs asserts the two agree.
 */

export const WALLET_ROLES = ['OWNER', 'EDITOR', 'VIEWER'] as const;
export type WalletRole = (typeof WALLET_ROLES)[number];
export const WalletRole = {
  OWNER: 'OWNER',
  EDITOR: 'EDITOR',
  VIEWER: 'VIEWER',
} as const;

export const MEMBER_STATUSES = ['ACTIVE', 'REVOKED'] as const;
export type MemberStatus = (typeof MEMBER_STATUSES)[number];
export const MemberStatus = {
  ACTIVE: 'ACTIVE',
  REVOKED: 'REVOKED',
} as const;

/** Roles an invitation may grant. Ownership transfers are a separate operation. */
export const INVITABLE_ROLES = ['EDITOR', 'VIEWER'] as const;
export type InvitableRole = (typeof INVITABLE_ROLES)[number];

export const WALLET_STATUSES = ['ACTIVE', 'ARCHIVED'] as const;
export type WalletStatus = (typeof WALLET_STATUSES)[number];
export const WalletStatus = {
  ACTIVE: 'ACTIVE',
  ARCHIVED: 'ARCHIVED',
} as const;

export const ACCOUNT_TYPES = ['BANK_ACCOUNT', 'CASH', 'E_WALLET', 'CREDIT_CARD'] as const;
export type AccountType = (typeof ACCOUNT_TYPES)[number];
export const AccountType = {
  BANK_ACCOUNT: 'BANK_ACCOUNT',
  CASH: 'CASH',
  E_WALLET: 'E_WALLET',
  CREDIT_CARD: 'CREDIT_CARD',
} as const;

export const ACCOUNT_STATUSES = ['ACTIVE', 'ARCHIVED'] as const;
export type AccountStatus = (typeof ACCOUNT_STATUSES)[number];
export const AccountStatus = {
  ACTIVE: 'ACTIVE',
  ARCHIVED: 'ARCHIVED',
} as const;

export const CATEGORY_TYPES = ['INCOME', 'EXPENSE'] as const;
export type CategoryType = (typeof CATEGORY_TYPES)[number];
export const CategoryType = {
  INCOME: 'INCOME',
  EXPENSE: 'EXPENSE',
} as const;

export const CATEGORY_STATUSES = ['ACTIVE', 'ARCHIVED'] as const;
export type CategoryStatus = (typeof CATEGORY_STATUSES)[number];
export const CategoryStatus = {
  ACTIVE: 'ACTIVE',
  ARCHIVED: 'ARCHIVED',
} as const;

export const TRANSACTION_TYPES = ['INCOME', 'EXPENSE', 'TRANSFER'] as const;
export type TransactionType = (typeof TRANSACTION_TYPES)[number];
export const TransactionType = {
  INCOME: 'INCOME',
  EXPENSE: 'EXPENSE',
  TRANSFER: 'TRANSFER',
} as const;

export const TRANSACTION_STATUSES = ['PENDING', 'COMPLETED', 'CANCELLED'] as const;
export type TransactionStatus = (typeof TRANSACTION_STATUSES)[number];
export const TransactionStatus = {
  PENDING: 'PENDING',
  COMPLETED: 'COMPLETED',
  CANCELLED: 'CANCELLED',
} as const;

export const BUDGET_PERIOD_TYPES = ['WEEKLY', 'MONTHLY', 'CUSTOM'] as const;
export type BudgetPeriodType = (typeof BUDGET_PERIOD_TYPES)[number];
export const BudgetPeriodType = {
  WEEKLY: 'WEEKLY',
  MONTHLY: 'MONTHLY',
  CUSTOM: 'CUSTOM',
} as const;

export const BUDGET_STATUSES = ['ACTIVE', 'ARCHIVED'] as const;
export type BudgetStatus = (typeof BUDGET_STATUSES)[number];
export const BudgetStatus = {
  ACTIVE: 'ACTIVE',
  ARCHIVED: 'ARCHIVED',
} as const;

export const GOAL_STATUSES = ['ACTIVE', 'COMPLETED', 'CANCELLED'] as const;
export type GoalStatus = (typeof GOAL_STATUSES)[number];
export const GoalStatus = {
  ACTIVE: 'ACTIVE',
  COMPLETED: 'COMPLETED',
  CANCELLED: 'CANCELLED',
} as const;

/**
 * User-preference enums. Lowercase (unlike every domain enum above) because
 * these are display slugs, not a CHECK constraint's value list authored in
 * upper-snake-case — added in db/migrations/002_google_auth_and_preferences.sql,
 * which check-contract-parity.mjs does not read (it's scoped to 001), so these
 * two are not in ENUM_TO_CONSTRAINT there.
 */
export const THEME_NAMES = ['obsidian', 'quartz', 'sage', 'terracotta', 'violet'] as const;
export type ThemeName = (typeof THEME_NAMES)[number];

export const LOCALES = ['en', 'vi', 'ko', 'ja', 'fr', 'de', 'zh', 'ru', 'es', 'hi'] as const;
export type Locale = (typeof LOCALES)[number];

/**
 * Ranking used by every access check. A required role is satisfied by any role
 * with at least its rank, so a guard reads `rankOf(actual) >= rankOf(required)`
 * instead of enumerating role combinations at each call site.
 */
const ROLE_RANK: Record<WalletRole, number> = {
  VIEWER: 1,
  EDITOR: 2,
  OWNER: 3,
};

export function rankOf(role: WalletRole): number {
  return ROLE_RANK[role];
}

export function roleSatisfies(actual: WalletRole | null, required: WalletRole): boolean {
  if (actual === null) return false;
  return ROLE_RANK[actual] >= ROLE_RANK[required];
}

/** Minimum role each kind of operation demands. */
export const REQUIRED_ROLE = {
  READ: 'VIEWER',
  WRITE: 'EDITOR',
  ADMINISTER: 'OWNER',
} as const satisfies Record<string, WalletRole>;

/** Shared pagination limits. */
export const DEFAULT_PAGE_SIZE = 25;
export const MAX_PAGE_SIZE = 200;
