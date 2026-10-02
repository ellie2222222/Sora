/**
 * Translating a constraint violation into the error code it means.
 *
 * The schema's unique and exclusion constraints are the real enforcement — the
 * `uq_wallet_single_owner` partial index and the `excl_budget_*_overlap` GIST
 * constraints reject races a pre-check cannot see, because between the check and
 * the insert another request can commit. So the insert is attempted and the
 * violation is translated, rather than trusting a SELECT that was true a
 * moment ago.
 */

import type { ErrorCode } from '@sora/contracts';

import { AppError } from './app-error.ts';

const UNIQUE_VIOLATION = '23505';
const EXCLUSION_VIOLATION = '23P01';
const CHECK_VIOLATION = '23514';

interface PgDatabaseError {
  code?: string;
  constraint?: string;
}

function asPgError(error: unknown): PgDatabaseError | null {
  if (typeof error !== 'object' || error === null) return null;
  const candidate = error as PgDatabaseError;
  return typeof candidate.code === 'string' ? candidate : null;
}

/** The constraint each violation maps onto, when the API has a code for it. */
const CONSTRAINT_CODES: Record<string, ErrorCode> = {
  uq_users_email: 'EMAIL_ALREADY_REGISTERED',
  uq_wallet_member: 'MEMBER_ALREADY_EXISTS',
  uq_wallet_single_owner: 'WALLET_LAST_OWNER',
  uq_wallet_invitation_open: 'INVITATION_ALREADY_OPEN',
  uq_category_name_per_parent: 'CATEGORY_DUPLICATE_NAME',
  excl_budget_category_overlap: 'BUDGET_PERIOD_OVERLAP',
  excl_budget_goal_overlap: 'BUDGET_PERIOD_OVERLAP',
  excl_budget_overall_overlap: 'BUDGET_PERIOD_OVERLAP',
  chk_invitation_role: 'VALIDATION_FAILED',
  chk_transaction_shape: 'VALIDATION_FAILED',
  chk_budget_dates: 'VALIDATION_FAILED',
  chk_budget_kind: 'VALIDATION_FAILED',
  chk_transaction_goal: 'VALIDATION_FAILED',
};

/**
 * Rethrow a constraint violation as the AppError it corresponds to, or rethrow
 * it untouched. Untouched is deliberate: an unmapped violation is a bug in this
 * layer, and turning it into a plausible-looking 409 would hide it.
 */
export function rethrowPgError(error: unknown, overrides: Record<string, ErrorCode> = {}): never {
  const pgError = asPgError(error);

  if (
    pgError &&
    (pgError.code === UNIQUE_VIOLATION ||
      pgError.code === EXCLUSION_VIOLATION ||
      pgError.code === CHECK_VIOLATION) &&
    pgError.constraint
  ) {
    const code = overrides[pgError.constraint] ?? CONSTRAINT_CODES[pgError.constraint];
    if (code) throw new AppError(code);
  }

  throw error;
}

/** Run `work`, translating any constraint violation it raises. */
export async function translatingPgErrors<T>(
  work: () => Promise<T>,
  overrides: Record<string, ErrorCode> = {},
): Promise<T> {
  try {
    return await work();
  } catch (error) {
    rethrowPgError(error, overrides);
  }
}
