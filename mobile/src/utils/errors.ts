/**
 * The one error shape the UI reads.
 *
 * The API owns every message it puts on the wire, so a screen renders
 * `error.message` rather than authoring a second phrasing for a condition the
 * server already reported. The fallbacks here exist only for the cases where
 * there is no server response to render: no network, a timeout, a non-JSON body.
 */

import { ERROR_STATUS, type ApiErrorBody, type ErrorCode } from '@sora/contracts';

export type FieldErrors = Record<string, string[]>;

export class ApiError extends Error {
  readonly code: ErrorCode;
  readonly status: number;
  readonly fields: FieldErrors;
  readonly params?: Record<string, unknown>;

  constructor(
    code: ErrorCode,
    message: string,
    status?: number,
    fields: FieldErrors = {},
    params?: Record<string, unknown>,
  ) {
    super(message);
    this.name = 'ApiError';
    this.code = code;
    this.status = status ?? ERROR_STATUS[code];
    this.fields = fields;
    if (params) this.params = params;
  }
}

export const NETWORK_ERROR_MESSAGE = 'No internet connection. Check your connection and try again.';
export const UNKNOWN_ERROR_MESSAGE = 'Something went wrong. Please try again.';

function isErrorBody(value: unknown): value is ApiErrorBody {
  if (typeof value !== 'object' || value === null) return false;
  const candidate = value as { error?: unknown; message?: unknown };
  if (typeof candidate.error !== 'object' || candidate.error === null) return false;
  return typeof (candidate.error as { code?: unknown }).code === 'string';
}

/**
 * Phrases transports use when no response arrived at all. Deliberately not bare "fetch" or
 * "connection": a server message such as "Account connection lost" is a response, not an outage,
 * and treating it as offline switches the app to its local guest data.
 */
const NO_RESPONSE_PHRASES = [
  'network',
  'cannot reach',
  'failed to fetch',
  'offline',
  'internet',
  'timeout',
  'timed out',
  'econnrefused',
] as const;
const NO_RESPONSE_CODES = new Set(['ERR_NETWORK', 'ECONNABORTED', 'ETIMEDOUT', 'ECONNREFUSED']);
const NO_RESPONSE_STATUSES = new Set<unknown>([0, 'FETCH_ERROR', 'TIMEOUT_ERROR']);

function describesNoResponse(message: string): boolean {
  const lower = message.toLowerCase();
  return NO_RESPONSE_PHRASES.some((phrase) => lower.includes(phrase));
}

/** True only when the request got no response — an HTTP status of any kind means the server was reached. */
export function isNetworkError(error: unknown): boolean {
  if (!error) return false;
  // toApiError gives every transport failure status 0; anything else carries a real server status.
  if (isApiError(error)) return error.status === 0;
  if (typeof error === 'string') return describesNoResponse(error);
  if (typeof error !== 'object') return false;

  const err = error as Record<string, unknown>;
  if (NO_RESPONSE_STATUSES.has(err.status)) return true;
  if (typeof err.code === 'string' && NO_RESPONSE_CODES.has(err.code)) return true;
  if (typeof err.response === 'object' && err.response !== null) return false;

  const message = typeof err.message === 'string' ? err.message : typeof err.error === 'string' ? err.error : '';
  return describesNoResponse(message);
}

/** Turn whatever the transport produced into an ApiError, never throwing itself. */
export function toApiError(status: number | undefined, body: unknown, transportMessage?: string): ApiError {
  if (isErrorBody(body)) {
    return new ApiError(
      body.error.code,
      body.message,
      status,
      body.error.fields ?? {},
      body.error.params,
    );
  }
  if (status === undefined) {
    return new ApiError('INTERNAL_ERROR', transportMessage ?? NETWORK_ERROR_MESSAGE, 0);
  }
  return new ApiError('INTERNAL_ERROR', transportMessage ?? UNKNOWN_ERROR_MESSAGE, status);
}

/** The data `ApiError` carries, with no prototype chain — see `serializeApiError`. */
export interface ApiErrorLike {
  readonly code: ErrorCode;
  readonly message: string;
  readonly status: number;
  readonly fields: FieldErrors;
  readonly params?: Record<string, unknown>;
}

/** Structural rather than `instanceof`, so it also matches a serialized (plain-object) `ApiErrorLike`. */
export function isApiError(error: unknown): error is ApiErrorLike {
  if (typeof error !== 'object' || error === null) return false;
  const candidate = error as Partial<ApiErrorLike>;
  return (
    typeof candidate.code === 'string' &&
    typeof candidate.message === 'string' &&
    typeof candidate.status === 'number' &&
    typeof candidate.fields === 'object' &&
    candidate.fields !== null
  );
}

/** Strips the `Error` prototype chain so the result is safe to put in Redux state/actions. */
export function serializeApiError(error: ApiErrorLike): ApiErrorLike {
  return { code: error.code, message: error.message, status: error.status, fields: error.fields, params: error.params };
}

export type TranslationFunction = (key: string, options?: Record<string, unknown>) => string;

/**
 * Type-safe map from every contracts ErrorCode to its local i18n translation key.
 * Adding a new ErrorCode to @sora/contracts causes a compile error here until mapped.
 */
export const ERROR_CODE_TO_I18N_KEY: Record<ErrorCode, string> = {
  VALIDATION_FAILED: 'errors.validationFailed',
  UNAUTHENTICATED: 'errors.unauthenticated',
  TOKEN_EXPIRED: 'errors.tokenExpired',
  TOKEN_INVALID: 'errors.tokenInvalid',
  CREDENTIALS_INVALID: 'errors.credentialsInvalid',
  EMAIL_ALREADY_REGISTERED: 'errors.emailAlreadyRegistered',
  FORBIDDEN: 'errors.forbidden',
  WALLET_NOT_FOUND: 'errors.walletNotFound',
  WALLET_ARCHIVED: 'errors.walletArchived',
  WALLET_LAST_OWNER: 'errors.walletLastOwner',
  MEMBER_NOT_FOUND: 'errors.memberNotFound',
  MEMBER_ALREADY_EXISTS: 'errors.memberAlreadyExists',
  INVITATION_NOT_FOUND: 'errors.invitationNotFound',
  INVITATION_EXPIRED: 'errors.invitationExpired',
  INVITATION_ALREADY_USED: 'errors.invitationAlreadyUsed',
  INVITATION_EMAIL_MISMATCH: 'errors.invitationEmailMismatch',
  INVITATION_ALREADY_OPEN: 'errors.invitationAlreadyOpen',
  ACCOUNT_NOT_FOUND: 'errors.accountNotFound',
  ACCOUNT_ARCHIVED: 'errors.accountArchived',
  ACCOUNT_CURRENCY_MISMATCH: 'errors.accountCurrencyMismatch',
  ACCOUNT_LAST_ACTIVE: 'errors.accountLastActive',
  CATEGORY_NOT_FOUND: 'errors.categoryNotFound',
  CATEGORY_WRONG_TYPE: 'errors.categoryWrongType',
  CATEGORY_WRONG_WALLET: 'errors.categoryWrongWallet',
  CATEGORY_DUPLICATE_NAME: 'errors.categoryDuplicateName',
  CATEGORY_CYCLE: 'errors.categoryCycle',
  CATEGORY_IN_USE: 'errors.categoryInUse',
  CATEGORY_HAS_TRANSACTIONS: 'errors.categoryHasTransactions',
  TRANSACTION_NOT_FOUND: 'errors.transactionNotFound',
  TRANSACTION_IMMUTABLE: 'errors.transactionImmutable',
  TRANSACTION_ALREADY_DELETED: 'errors.transactionAlreadyDeleted',
  TRANSFER_SAME_ACCOUNT: 'errors.transferSameAccount',
  TRANSFER_CURRENCY_MISMATCH: 'errors.transferCurrencyMismatch',
  BUDGET_NOT_FOUND: 'errors.budgetNotFound',
  BUDGET_PERIOD_OVERLAP: 'errors.budgetPeriodOverlap',
  GOAL_NOT_FOUND: 'errors.goalNotFound',
  GOAL_NOT_ACTIVE: 'errors.goalNotActive',
  CONTRIBUTION_NOT_FOUND: 'errors.contributionNotFound',
  RATE_LIMITED: 'errors.rateLimited',
  INTERNAL_ERROR: 'errors.internalError',
  GOOGLE_TOKEN_INVALID: 'errors.googleTokenInvalid',
  VALUATION_UNAVAILABLE: 'errors.valuationUnavailable',
};

export function getServerErrorMessage(error: unknown, t: TranslationFunction): string {
  if (isNetworkError(error)) {
    return t('errors.offlineTitle');
  }
  if (isApiError(error)) {
    const key = ERROR_CODE_TO_I18N_KEY[error.code];
    if (key) {
      return t(key, error.params);
    }
  }
  return t('errors.somethingWentWrong');
}

export function messageOf(
  error: unknown,
  t?: TranslationFunction,
  fallback: string = UNKNOWN_ERROR_MESSAGE,
): string {
  if (t) {
    return getServerErrorMessage(error, t);
  }
  if (isApiError(error)) return error.message || fallback;
  if (error instanceof Error && error.message) return error.message;
  return fallback;
}

/** A 401 the interceptor could not repair — the session is genuinely over. */
export function isUnauthenticated(error: unknown): boolean {
  if (!isApiError(error)) return false;
  return (
    error.code === 'UNAUTHENTICATED' ||
    error.code === 'TOKEN_EXPIRED' ||
    error.code === 'TOKEN_INVALID'
  );
}
