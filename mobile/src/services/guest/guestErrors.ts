/**
 * Errors the guest repository raises, in the exact shape the UI already
 * knows how to render.
 *
 * Screens read `error.message`/`error.fields` off an `ApiError`
 * (`utils/errors.ts`) regardless of whether the request went to the real API
 * or the guest repository — there is no guest-only branch in error handling
 * anywhere in the UI. Messages mirror `server/src/common/app-error.ts`'s
 * `MESSAGES` verbatim for the codes guest mode can actually raise, and
 * `fromZodError` mirrors `all-exceptions.filter.ts`'s `fieldsOf` so a local
 * validation failure looks identical to a server one.
 */

import type { ZodError } from 'zod';
import type { ErrorCode } from '@sora/contracts';

// Relative, not `@/utils`: this file is reached by bare `node --test` (no bundler,
// no path-alias resolution at runtime), unlike the rest of the app.
import { ApiError, type FieldErrors } from '../../utils/errors.ts';

const GUEST_ERROR_MESSAGES: Partial<Record<ErrorCode, string>> = {
  VALIDATION_FAILED: 'The request could not be validated',
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
  CATEGORY_HAS_TRANSACTIONS:
    'This category has transactions — rename or archive it instead of deleting it permanently',
  CATEGORY_PARENT_ARCHIVED: 'Its parent category is archived — restore the parent first',
  CATEGORY_ARCHIVED: 'This category is archived — restore it to plan a budget for it',
  TRANSACTION_NOT_FOUND: 'Transaction not found',
  TRANSACTION_ALREADY_DELETED: 'This transaction is already deleted',
  TRANSFER_SAME_ACCOUNT: 'A transfer needs two different accounts',
  TRANSFER_CURRENCY_MISMATCH: 'Both sides of a transfer must share one currency',
  BUDGET_NOT_FOUND: 'Budget not found',
  BUDGET_PERIOD_OVERLAP: 'An active budget for this category already covers part of that period',
  GOAL_NOT_FOUND: 'Goal not found',
  GOAL_NOT_ACTIVE: 'This goal is not active',
  CONTRIBUTION_NOT_FOUND: 'Contribution not found',
  WALLET_NOT_FOUND: 'Wallet not found',
};

export function guestError(code: ErrorCode, fields?: FieldErrors): ApiError {
  return new ApiError(code, GUEST_ERROR_MESSAGES[code] ?? 'Something went wrong', undefined, fields);
}

/** Mirrors `all-exceptions.filter.ts`'s `fieldsOf` + message selection. */
export function fromZodError(error: ZodError): ApiError {
  const fields: FieldErrors = {};
  for (const issue of error.issues) {
    const key = issue.path.length > 0 ? issue.path.join('.') : '_';
    const existing = fields[key];
    if (existing) existing.push(issue.message);
    else fields[key] = [issue.message];
  }

  return new ApiError(
    'VALIDATION_FAILED',
    error.issues[0]?.message ?? GUEST_ERROR_MESSAGES.VALIDATION_FAILED!,
    undefined,
    fields,
  );
}
