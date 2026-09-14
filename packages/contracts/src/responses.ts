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
  ValuationStatus,
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
    /** Optional interpolation parameters for local client i18n translation. */
    params?: Record<string, unknown>;
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
  'VALUATION_UNAVAILABLE',
] as const;

export type ErrorCode = (typeof ERROR_CODES)[number];

/**
 * Every HTTP status this API returns, named once.
 *
 * Two of them look like mistakes without the specification beside them: `410`
 * for an expired invitation, and `404` where a non-member is refused — `403`
 * there would confirm the resource exists (AC-01). Naming them keeps that
 * intent legible at the call site instead of leaving a bare number to be
 * "corrected" later.
 */
export const HTTP_STATUS = {
  OK: 200,
  CREATED: 201,
  NO_CONTENT: 204,
  BAD_REQUEST: 400,
  UNAUTHORIZED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  CONFLICT: 409,
  GONE: 410,
  UNPROCESSABLE_ENTITY: 422,
  TOO_MANY_REQUESTS: 429,
  INTERNAL_SERVER_ERROR: 500,
  SERVICE_UNAVAILABLE: 503,
} as const;

export type HttpStatusCode = (typeof HTTP_STATUS)[keyof typeof HTTP_STATUS];

/**
 * HTTP status each error code maps to, per the API's status conventions.
 *
 * `scripts/check-contract-parity.mjs` reads this map as text, so each entry
 * must stay one `CODE: HTTP_STATUS.NAME` pair per line for it to parse.
 */
export const ERROR_STATUS: Record<ErrorCode, HttpStatusCode> = {
  VALIDATION_FAILED: HTTP_STATUS.UNPROCESSABLE_ENTITY,
  UNAUTHENTICATED: HTTP_STATUS.UNAUTHORIZED,
  TOKEN_EXPIRED: HTTP_STATUS.UNAUTHORIZED,
  TOKEN_INVALID: HTTP_STATUS.UNAUTHORIZED,
  CREDENTIALS_INVALID: HTTP_STATUS.UNAUTHORIZED,
  EMAIL_ALREADY_REGISTERED: HTTP_STATUS.CONFLICT,
  FORBIDDEN: HTTP_STATUS.FORBIDDEN,
  WALLET_NOT_FOUND: HTTP_STATUS.NOT_FOUND,
  WALLET_ARCHIVED: HTTP_STATUS.CONFLICT,
  WALLET_LAST_OWNER: HTTP_STATUS.CONFLICT,
  MEMBER_NOT_FOUND: HTTP_STATUS.NOT_FOUND,
  MEMBER_ALREADY_EXISTS: HTTP_STATUS.CONFLICT,
  INVITATION_NOT_FOUND: HTTP_STATUS.NOT_FOUND,
  INVITATION_EXPIRED: HTTP_STATUS.GONE,
  INVITATION_ALREADY_USED: HTTP_STATUS.CONFLICT,
  INVITATION_EMAIL_MISMATCH: HTTP_STATUS.FORBIDDEN,
  INVITATION_ALREADY_OPEN: HTTP_STATUS.CONFLICT,
  ACCOUNT_NOT_FOUND: HTTP_STATUS.NOT_FOUND,
  ACCOUNT_ARCHIVED: HTTP_STATUS.CONFLICT,
  ACCOUNT_CURRENCY_MISMATCH: HTTP_STATUS.UNPROCESSABLE_ENTITY,
  ACCOUNT_LAST_ACTIVE: HTTP_STATUS.CONFLICT,
  CATEGORY_NOT_FOUND: HTTP_STATUS.NOT_FOUND,
  CATEGORY_WRONG_TYPE: HTTP_STATUS.UNPROCESSABLE_ENTITY,
  CATEGORY_WRONG_WALLET: HTTP_STATUS.FORBIDDEN,
  CATEGORY_DUPLICATE_NAME: HTTP_STATUS.CONFLICT,
  CATEGORY_CYCLE: HTTP_STATUS.UNPROCESSABLE_ENTITY,
  CATEGORY_IN_USE: HTTP_STATUS.CONFLICT,
  CATEGORY_HAS_TRANSACTIONS: HTTP_STATUS.CONFLICT,
  TRANSACTION_NOT_FOUND: HTTP_STATUS.NOT_FOUND,
  TRANSACTION_IMMUTABLE: HTTP_STATUS.CONFLICT,
  TRANSACTION_ALREADY_CANCELLED: HTTP_STATUS.CONFLICT,
  TRANSFER_SAME_ACCOUNT: HTTP_STATUS.UNPROCESSABLE_ENTITY,
  TRANSFER_CURRENCY_MISMATCH: HTTP_STATUS.UNPROCESSABLE_ENTITY,
  BUDGET_NOT_FOUND: HTTP_STATUS.NOT_FOUND,
  BUDGET_PERIOD_OVERLAP: HTTP_STATUS.CONFLICT,
  GOAL_NOT_FOUND: HTTP_STATUS.NOT_FOUND,
  GOAL_NOT_ACTIVE: HTTP_STATUS.CONFLICT,
  CONTRIBUTION_NOT_FOUND: HTTP_STATUS.NOT_FOUND,
  RATE_LIMITED: HTTP_STATUS.TOO_MANY_REQUESTS,
  INTERNAL_ERROR: HTTP_STATUS.INTERNAL_SERVER_ERROR,
  GOOGLE_TOKEN_INVALID: HTTP_STATUS.UNAUTHORIZED,
  VALUATION_UNAVAILABLE: HTTP_STATUS.SERVICE_UNAVAILABLE,
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

export interface ConvertedValuation {
  currency: string;
  amount: MoneyString | null;
  isApproximate: boolean;
  rateTimestamp?: string;
  status: ValuationStatus;
  missingCurrencies?: string[];
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
  /** Optional converted valuation estimate for total balance across currencies. */
  valuation?: ConvertedValuation | null;
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
