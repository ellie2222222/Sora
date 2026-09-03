/**
 * Response shapes and the error-code vocabulary.
 *
 * Money is a string in every response, matching the reasoning in money.ts. Dates
 * are ISO-8601: calendar dates as YYYY-MM-DD, instants with an offset.
 */

import type {
  AccountStatus,
  AccountType,
  BudgetPeriodType,
  BudgetStatus,
  CategoryStatus,
  CategoryType,
  GoalStatus,
  Locale,
  MemberStatus,
  ThemeName,
  TransactionStatus,
  TransactionType,
  WalletRole,
  WalletStatus,
} from './enums.ts';
import type { MoneyString } from './money.ts';

/** Every response body, success or failure, is wrapped in this envelope. */
export interface ApiEnvelope<T> {
  success: boolean;
  message?: string;
  data: T;
  meta: {
    timestamp: string;
    pagination?: PaginationMeta;
  };
}

export interface PaginationMeta {
  page: number;
  pageSize: number;
  total: number;
  hasMore: boolean;
}

export interface ApiErrorBody {
  success: false;
  message: string;
  error: {
    code: ErrorCode;
    /** Field-level detail, keyed by the request path that failed. */
    fields?: Record<string, string[]>;
  };
  meta: { timestamp: string };
}

// ---------------------------------------------------------------------------
// Error codes
// ---------------------------------------------------------------------------

export const ERROR_CODES = [
  'VALIDATION_FAILED',
  'UNAUTHENTICATED',
  'TOKEN_EXPIRED',
  'TOKEN_INVALID',
  'CREDENTIALS_INVALID',
  'EMAIL_ALREADY_REGISTERED',
  'FORBIDDEN',
  'WALLET_NOT_FOUND',
  'WALLET_ARCHIVED',
  'WALLET_LAST_OWNER',
  'MEMBER_NOT_FOUND',
  'MEMBER_ALREADY_EXISTS',
  'INVITATION_NOT_FOUND',
  'INVITATION_EXPIRED',
  'INVITATION_ALREADY_USED',
  'INVITATION_EMAIL_MISMATCH',
  'INVITATION_ALREADY_OPEN',
  'ACCOUNT_NOT_FOUND',
  'ACCOUNT_ARCHIVED',
  'ACCOUNT_CURRENCY_MISMATCH',
  'ACCOUNT_LAST_ACTIVE',
  'CATEGORY_NOT_FOUND',
  'CATEGORY_WRONG_TYPE',
  'CATEGORY_WRONG_WALLET',
  'CATEGORY_DUPLICATE_NAME',
  'CATEGORY_CYCLE',
  'CATEGORY_IN_USE',
  'CATEGORY_HAS_TRANSACTIONS',
  'TRANSACTION_NOT_FOUND',
  'TRANSACTION_IMMUTABLE',
  'TRANSACTION_ALREADY_CANCELLED',
  'TRANSFER_SAME_ACCOUNT',
  'TRANSFER_CURRENCY_MISMATCH',
  'BUDGET_NOT_FOUND',
  'BUDGET_PERIOD_OVERLAP',
  'GOAL_NOT_FOUND',
  'GOAL_NOT_ACTIVE',
  'CONTRIBUTION_NOT_FOUND',
  'RATE_LIMITED',
  'INTERNAL_ERROR',
  'GOOGLE_TOKEN_INVALID',
] as const;

export type ErrorCode = (typeof ERROR_CODES)[number];

/** HTTP status each error code maps to, per the API's status conventions. */
export const ERROR_STATUS: Record<ErrorCode, number> = {
  VALIDATION_FAILED: 422,
  UNAUTHENTICATED: 401,
  TOKEN_EXPIRED: 401,
  TOKEN_INVALID: 401,
  CREDENTIALS_INVALID: 401,
  EMAIL_ALREADY_REGISTERED: 409,
  FORBIDDEN: 403,
  WALLET_NOT_FOUND: 404,
  WALLET_ARCHIVED: 409,
  WALLET_LAST_OWNER: 409,
  MEMBER_NOT_FOUND: 404,
  MEMBER_ALREADY_EXISTS: 409,
  INVITATION_NOT_FOUND: 404,
  INVITATION_EXPIRED: 410,
  INVITATION_ALREADY_USED: 409,
  INVITATION_EMAIL_MISMATCH: 403,
  INVITATION_ALREADY_OPEN: 409,
  ACCOUNT_NOT_FOUND: 404,
  ACCOUNT_ARCHIVED: 409,
  ACCOUNT_CURRENCY_MISMATCH: 422,
  ACCOUNT_LAST_ACTIVE: 409,
  CATEGORY_NOT_FOUND: 404,
  CATEGORY_WRONG_TYPE: 422,
  CATEGORY_WRONG_WALLET: 403,
  CATEGORY_DUPLICATE_NAME: 409,
  CATEGORY_CYCLE: 422,
  CATEGORY_IN_USE: 409,
  CATEGORY_HAS_TRANSACTIONS: 409,
  TRANSACTION_NOT_FOUND: 404,
  TRANSACTION_IMMUTABLE: 409,
  TRANSACTION_ALREADY_CANCELLED: 409,
  TRANSFER_SAME_ACCOUNT: 422,
  TRANSFER_CURRENCY_MISMATCH: 422,
  BUDGET_NOT_FOUND: 404,
  BUDGET_PERIOD_OVERLAP: 409,
  GOAL_NOT_FOUND: 404,
  GOAL_NOT_ACTIVE: 409,
  CONTRIBUTION_NOT_FOUND: 404,
  RATE_LIMITED: 429,
  INTERNAL_ERROR: 500,
  GOOGLE_TOKEN_INVALID: 401,
};

// ---------------------------------------------------------------------------
// Resources
// ---------------------------------------------------------------------------

export interface UserResponse {
  id: string;
  email: string;
  displayName: string;
  baseCurrency: string;
  theme: ThemeName;
  locale: Locale;
  hasPassword: boolean;
  createdAt: string;
}

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
  /** Seconds until accessToken expires. */
  expiresIn: number;
}

export interface AuthResponse {
  user: UserResponse;
  tokens: AuthTokens;
}

export interface WalletResponse {
  id: string;
  name: string;
  status: WalletStatus;
  ownerUserId: string;
  /** The requesting user's role on this wallet. Never null in a list they can see. */
  role: WalletRole;
  /** This viewer's own label for the wallet, e.g. "Girlfriend". */
  relationLabel: string | null;
  isOwn: boolean;
  memberCount: number;
  accountCount: number;
  /**
   * Totals per currency. A wallet holding VND and USD accounts reports both
   * rather than one meaningless sum — conversion is out of scope.
   */
  balances: CurrencyTotal[];
  createdAt: string;
  updatedAt: string;
}

export interface CurrencyTotal {
  currency: string;
  amount: MoneyString;
}

export interface WalletMemberResponse {
  id: string;
  walletId: string;
  userId: string;
  displayName: string;
  email: string;
  role: WalletRole;
  relationLabel: string | null;
  status: MemberStatus;
  joinedAt: string;
}

export interface WalletInvitationResponse {
  id: string;
  walletId: string;
  walletName: string;
  invitedEmail: string;
  role: WalletRole;
  relationLabel: string | null;
  expiresAt: string;
  createdAt: string;
}

/** Returned on create so the inviter can deliver the link out of band. */
export interface WalletInvitationCreatedResponse extends WalletInvitationResponse {
  token: string;
}

/**
 * The unauthenticated preview (§8.4). Deliberately narrower than
 * WalletInvitationResponse: no ids, and `invitedEmail` arrives masked, because
 * the endpoint is public and the token may have been pasted anywhere.
 */
export interface InvitationPreviewResponse {
  walletName: string;
  invitedEmail: string;
  role: WalletRole;
  expiresAt: string;
}

export interface AccountResponse {
  id: string;
  walletId: string;
  name: string;
  type: AccountType;
  currency: string;
  initialBalance: MoneyString;
  /** Derived from completed transactions, never stored. */
  balance: MoneyString;
  status: AccountStatus;
  createdAt: string;
  updatedAt: string;
}

export interface AccountDetailResponse extends AccountResponse {
  totalIncome: MoneyString;
  totalExpense: MoneyString;
  transferredIn: MoneyString;
  transferredOut: MoneyString;
  transactionCount: number;
}

export interface CategoryResponse {
  id: string;
  walletId: string;
  parentId: string | null;
  name: string;
  type: CategoryType;
  icon: string | null;
  color: string | null;
  status: CategoryStatus;
  /**
   * How many transactions (any status) point at this category. Read before
   * offering "delete permanently" — the app disables that option and offers
   * rename/archive instead whenever this is non-zero (§10.4).
   */
  transactionCount: number;
  children?: CategoryResponse[];
}

/** An account as a transaction refers to it, with the wallet it belongs to. */
export interface TransactionAccountRef {
  id: string;
  name: string;
  currency: string;
  walletId: string;
  walletName: string;
}

export interface TransactionResponse {
  id: string;
  type: TransactionType;
  status: TransactionStatus;
  amount: MoneyString;
  currency: string;
  description: string | null;
  transactionDate: string;
  reference: string | null;
  fromAccount: TransactionAccountRef | null;
  toAccount: TransactionAccountRef | null;
  category: Pick<CategoryResponse, 'id' | 'name' | 'type' | 'icon' | 'color'> | null;
  createdBy: Pick<UserResponse, 'id' | 'displayName'>;
  /** True when the two accounts sit in different wallets. */
  isCrossWallet: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface BudgetResponse {
  id: string;
  walletId: string;
  name: string;
  amount: MoneyString;
  currency: string;
  periodType: BudgetPeriodType;
  startDate: string;
  endDate: string;
  status: BudgetStatus;
  category: Pick<CategoryResponse, 'id' | 'name' | 'icon' | 'color'>;
  spent: MoneyString;
  /** Negative once overspent — the number a user needs when they are over. */
  remaining: MoneyString;
  usagePercentage: number;
  isOverBudget: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface GoalResponse {
  id: string;
  walletId: string;
  name: string;
  description: string | null;
  targetAmount: MoneyString;
  currency: string;
  targetDate: string | null;
  status: GoalStatus;
  currentAmount: MoneyString;
  remaining: MoneyString;
  progressPercentage: number;
  contributionCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface ContributionResponse {
  id: string;
  goalId: string;
  accountId: string;
  accountName: string;
  transactionId: string | null;
  amount: MoneyString;
  currency: string;
  contributionDate: string;
  note: string | null;
  createdAt: string;
}

export interface CategorySpendSlice {
  categoryId: string;
  categoryName: string;
  icon: string | null;
  color: string | null;
  amount: MoneyString;
  percentage: number;
}

export interface DashboardResponse {
  walletId: string;
  period: { dateFrom: string; dateTo: string };
  /** Per-currency, for the same reason WalletResponse.balances is. */
  totalBalance: CurrencyTotal[];
  income: CurrencyTotal[];
  expense: CurrencyTotal[];
  net: CurrencyTotal[];
  spendingByCategory: CategorySpendSlice[];
  recentTransactions: TransactionResponse[];
  activeBudgets: BudgetResponse[];
  activeGoals: GoalResponse[];
}

export interface AuditLogResponse {
  id: string;
  event: string;
  entityType: string;
  entityId: string | null;
  result: 'SUCCESS' | 'DENIED' | 'FAILURE';
  actorId: string | null;
  actorRole: WalletRole | null;
  note: string | null;
  createdAt: string;
}
