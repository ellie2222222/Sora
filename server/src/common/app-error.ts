/**
 * The one error type every service throws.
 *
 * It carries an ErrorCode from @sora/contracts rather than an HTTP status:
 * ERROR_STATUS is the single mapping from code to status, so a service never
 * picks a number and the API's status conventions cannot drift per call site.
 */

import { ERROR_STATUS, type ErrorCode } from '@sora/contracts';

export class AppError extends Error {
  readonly code: ErrorCode;
  readonly fields?: Record<string, string[]>;

  constructor(code: ErrorCode, message?: string, fields?: Record<string, string[]>) {
    super(message ?? defaultMessage(code));
    this.name = 'AppError';
    this.code = code;
    if (fields) this.fields = fields;
  }

  get status(): number {
    return ERROR_STATUS[this.code];
  }
}

const MESSAGES: Record<ErrorCode, string> = {
  VALIDATION_FAILED: 'The request could not be validated',
  UNAUTHENTICATED: 'Authentication is required',
  TOKEN_EXPIRED: 'The token has expired',
  TOKEN_INVALID: 'The token is not valid',
  CREDENTIALS_INVALID: 'Email or password is incorrect',
  EMAIL_ALREADY_REGISTERED: 'That email address is already registered',
  FORBIDDEN: 'Your role on this wallet does not allow that',
  WALLET_NOT_FOUND: 'Wallet not found',
  WALLET_ARCHIVED: 'This wallet is archived and does not accept new entries',
  WALLET_LAST_OWNER: 'A wallet must keep one owner — transfer ownership or archive it first',
  MEMBER_NOT_FOUND: 'Member not found on this wallet',
  MEMBER_ALREADY_EXISTS: 'That person is already a member of this wallet',
  INVITATION_NOT_FOUND: 'Invitation not found',
  INVITATION_EXPIRED: 'This invitation has expired',
  INVITATION_ALREADY_USED: 'This invitation has already been used',
  INVITATION_EMAIL_MISMATCH: 'This invitation was addressed to a different email address',
  INVITATION_ALREADY_OPEN: 'An open invitation for that email already exists on this wallet',
  ACCOUNT_NOT_FOUND: 'Account not found',
  ACCOUNT_ARCHIVED: 'This account is archived and does not accept new entries',
  ACCOUNT_CURRENCY_MISMATCH: "The amount's currency does not match the account's currency",
  ACCOUNT_LAST_ACTIVE: 'A wallet must keep one active account — archive it after adding another',
  CATEGORY_NOT_FOUND: 'Category not found',
  CATEGORY_WRONG_TYPE: "The category's type does not match",
  CATEGORY_WRONG_WALLET: 'That category belongs to a different wallet',
  CATEGORY_DUPLICATE_NAME: 'A sibling category already uses that name',
  CATEGORY_CYCLE: 'That parent would create a cycle in the category tree',
  CATEGORY_IN_USE: 'An active budget still references this category',
  CATEGORY_HAS_TRANSACTIONS: 'This category has transactions — rename or archive it instead of deleting it permanently',
  TRANSACTION_NOT_FOUND: 'Transaction not found',
  TRANSACTION_IMMUTABLE: 'Amount, type and accounts cannot be changed — cancel and re-record instead',
  TRANSACTION_ALREADY_CANCELLED: 'This transaction is already cancelled',
  TRANSFER_SAME_ACCOUNT: 'A transfer needs two different accounts',
  TRANSFER_CURRENCY_MISMATCH: 'Both sides of a transfer must share one currency',
  BUDGET_NOT_FOUND: 'Budget not found',
  BUDGET_PERIOD_OVERLAP: 'An active budget for this category already covers part of that period',
  GOAL_NOT_FOUND: 'Goal not found',
  GOAL_NOT_ACTIVE: 'This goal is not active',
  CONTRIBUTION_NOT_FOUND: 'Contribution not found',
  RATE_LIMITED: 'Too many requests — try again shortly',
  INTERNAL_ERROR: 'Something went wrong on our side',
  GOOGLE_TOKEN_INVALID: 'Google sign-in could not be verified',
};

function defaultMessage(code: ErrorCode): string {
  return MESSAGES[code];
}
