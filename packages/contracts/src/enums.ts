/**
 * Domain enumerations.
 *
 * Every member string is byte-identical to the value the corresponding CHECK
 * constraint in db/migrations/ allows. A mismatch
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

export const CATEGORY_TYPES = ['INCOME', 'EXPENSE', 'TRANSFER'] as const;
export type CategoryType = (typeof CATEGORY_TYPES)[number];
export const CategoryType = {
  INCOME: 'INCOME',
  EXPENSE: 'EXPENSE',
  TRANSFER: 'TRANSFER',
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

export const TRANSACTION_STATUSES = ['PENDING', 'COMPLETED', 'DELETED'] as const;
export type TransactionStatus = (typeof TRANSACTION_STATUSES)[number];
export const TransactionStatus = {
  PENDING: 'PENDING',
  COMPLETED: 'COMPLETED',
  DELETED: 'DELETED',
} as const;

export const BUDGET_PERIOD_TYPES = ['DAILY', 'WEEKLY', 'MONTHLY', 'YEARLY', 'CUSTOM', 'GOAL'] as const;
export type BudgetPeriodType = (typeof BUDGET_PERIOD_TYPES)[number];
export const BudgetPeriodType = {
  DAILY: 'DAILY',
  WEEKLY: 'WEEKLY',
  MONTHLY: 'MONTHLY',
  YEARLY: 'YEARLY',
  CUSTOM: 'CUSTOM',
  GOAL: 'GOAL',
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

export const VALUATION_STATUSES = ['FRESH', 'STALE', 'UNAVAILABLE'] as const;
export type ValuationStatus = (typeof VALUATION_STATUSES)[number];
export const ValuationStatus = {
  FRESH: 'FRESH',
  STALE: 'STALE',
  UNAVAILABLE: 'UNAVAILABLE',
} as const;

/** Who wrote an AI chat message. The system prompt is built per request and never stored. */
export const AI_MESSAGE_ROLES = ['USER', 'ASSISTANT'] as const;
export type AiMessageRole = (typeof AI_MESSAGE_ROLES)[number];
export const AiMessageRole = {
  USER: 'USER',
  ASSISTANT: 'ASSISTANT',
} as const;

export const AI_ACTION_TYPES = ['CREATE_TRANSACTION'] as const;
export type AiActionType = (typeof AI_ACTION_TYPES)[number];
export const AiActionType = {
  CREATE_TRANSACTION: 'CREATE_TRANSACTION',
} as const;

/** An assistant's proposal stays PENDING until the user confirms or dismisses it. */
export const AI_ACTION_STATUSES = ['PENDING', 'CONFIRMED', 'DISMISSED'] as const;
export type AiActionStatus = (typeof AI_ACTION_STATUSES)[number];
export const AiActionStatus = {
  PENDING: 'PENDING',
  CONFIRMED: 'CONFIRMED',
  DISMISSED: 'DISMISSED',
} as const;

/**
 * Lowercase display slugs, not upper-snake-case like the domain enums, so
 * check-contract-parity.mjs (which matches only upper-snake-case values) doesn't check them.
 */
export const THEME_NAMES = ['obsidian', 'quartz', 'sage', 'terracotta', 'violet'] as const;
export type ThemeName = (typeof THEME_NAMES)[number];

export const LOCALES = ['en', 'vi'] as const;
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

export const DEFAULT_PAGE_SIZE = 25;
export const MAX_PAGE_SIZE = 200;
