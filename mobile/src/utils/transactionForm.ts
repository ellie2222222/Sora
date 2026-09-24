/**
 * The one transaction form's type-switching rules, as pure functions.
 *
 * Plan §12 asks for a single form whose fields change with the type. The awkward
 * part is not showing and hiding inputs, it is what happens to what the user
 * already typed: an EXPENSE names its account in `fromAccountId` and an INCOME
 * names the same account in `toAccountId`, so a naive toggle either loses the
 * selection or leaves it on the side the new type forbids — which the API then
 * rejects as a shape violation.
 *
 * Validation itself is never re-expressed here. `validateDraft` projects the wide
 * draft onto the exact per-type shape and hands it to `createTransactionSchema`,
 * the same object the API validates with.
 */

import {
  createTransactionSchema,
  TransactionType,
  CategoryType,
  TransactionStatus,
  type CreateTransactionRequest,
  type TransactionResponse,
} from '@sora/contracts';

/** Every field the form can hold, regardless of which type is selected. */
export interface TransactionDraft {
  type: TransactionType;
  amount: string;
  currency: string;
  fromAccountId: string | null;
  toAccountId: string | null;
  categoryId: string | null;
  description: string;
  reference: string;
  transactionDate: string;
  status: TransactionStatus;
}

export interface DraftFieldVisibility {
  fromAccount: boolean;
  toAccount: boolean;
  category: boolean;
}

export interface EmptyDraftOptions {
  type?: TransactionType;
  currency: string;
  transactionDate: string;
  fromAccountId?: string | null;
  toAccountId?: string | null;
}

export function emptyDraft(options: EmptyDraftOptions): TransactionDraft {
  return {
    type: options.type ?? TransactionType.EXPENSE,
    amount: '',
    currency: options.currency,
    fromAccountId: options.fromAccountId ?? null,
    toAccountId: options.toAccountId ?? null,
    categoryId: null,
    description: '',
    reference: '',
    transactionDate: options.transactionDate,
    status: TransactionStatus.COMPLETED,
  };
}

/** Which inputs a type actually owns (API spec §11's shape table). */
export function fieldsForType(type: TransactionType): DraftFieldVisibility {
  switch (type) {
    case TransactionType.INCOME:
      return { fromAccount: false, toAccount: true, category: true };
    case TransactionType.EXPENSE:
      return { fromAccount: true, toAccount: false, category: true };
    case TransactionType.TRANSFER:
      return { fromAccount: true, toAccount: true, category: true };
  }
}

/** The category type a transaction type takes — required for income/expense, optional for a transfer. */
export function categoryTypeFor(type: TransactionType): CategoryType {
  if (type === TransactionType.INCOME) return CategoryType.INCOME;
  if (type === TransactionType.EXPENSE) return CategoryType.EXPENSE;
  return CategoryType.TRANSFER;
}

/**
 * Switch the type, carrying the account the user already picked to whichever
 * side the new type names, and dropping anything the new type cannot hold.
 *
 * The category is always cleared on a real change: each type takes its own
 * category type, so no previously chosen category can still be valid.
 */
export function switchType(draft: TransactionDraft, next: TransactionType): TransactionDraft {
  if (draft.type === next) return draft;

  // Which side to read the carried account from depends on the side the NEW type
  // owns: an expense keeps the source it was paying from, income keeps the
  // destination the money was arriving at. Reading one side for both silently
  // retargets a switched transfer at the wrong account, and since either id is a
  // valid uuid, neither the schema nor the database objects.
  switch (next) {
    case TransactionType.EXPENSE:
      return {
        ...draft,
        type: next,
        fromAccountId: draft.fromAccountId ?? draft.toAccountId,
        toAccountId: null,
        categoryId: null,
      };
    case TransactionType.INCOME:
      return {
        ...draft,
        type: next,
        fromAccountId: null,
        toAccountId: draft.toAccountId ?? draft.fromAccountId,
        categoryId: null,
      };
    case TransactionType.TRANSFER:
      return {
        ...draft,
        type: next,
        fromAccountId: draft.fromAccountId ?? draft.toAccountId,
        toAccountId: draft.type === TransactionType.INCOME ? null : draft.toAccountId,
        categoryId: null,
      };
  }
}

/** Set whichever account side the current type uses for a single-account entry. */
export function setPrimaryAccount(
  draft: TransactionDraft,
  accountId: string | null,
): TransactionDraft {
  if (draft.type === TransactionType.INCOME) return { ...draft, toAccountId: accountId };
  return { ...draft, fromAccountId: accountId };
}

export function primaryAccountOf(draft: TransactionDraft): string | null {
  return draft.type === TransactionType.INCOME ? draft.toAccountId : draft.fromAccountId;
}

function textOrNull(value: string): string | null {
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

/**
 * Project the wide draft onto the exact object the API's discriminated union
 * expects. Keys the selected type does not own are absent, not null — the union
 * has no member carrying a `toAccountId` on an EXPENSE.
 */
export function buildCreatePayload(draft: TransactionDraft): unknown {
  const common = {
    amount: draft.amount,
    currency: draft.currency,
    description: textOrNull(draft.description),
    transactionDate: draft.transactionDate,
    status: draft.status,
    reference: textOrNull(draft.reference),
  };

  switch (draft.type) {
    case TransactionType.INCOME:
      return { type: TransactionType.INCOME, toAccountId: draft.toAccountId, categoryId: draft.categoryId, ...common };
    case TransactionType.EXPENSE:
      return { type: TransactionType.EXPENSE, fromAccountId: draft.fromAccountId, categoryId: draft.categoryId, ...common };
    case TransactionType.TRANSFER:
      return {
        type: TransactionType.TRANSFER,
        fromAccountId: draft.fromAccountId,
        toAccountId: draft.toAccountId,
        categoryId: draft.categoryId,
        ...common,
      };
  }
}

export interface DraftIssue {
  path: string;
  message: string;
}

export type DraftValidation =
  | { ok: true; payload: CreateTransactionRequest }
  | { ok: false; issues: DraftIssue[] };

/**
 * Validate a draft with the shared contract schema.
 *
 * A missing account arrives from Zod as an `invalid_type` on a path the draft
 * genuinely has, so the issue paths map straight onto form fields with no
 * translation table to drift.
 */
export function validateDraft(draft: TransactionDraft): DraftValidation {
  const parsed = createTransactionSchema.safeParse(buildCreatePayload(draft));
  if (parsed.success) return { ok: true, payload: parsed.data };

  return {
    ok: false,
    issues: parsed.error.issues.map((issue) => ({
      path: issue.path.length > 0 ? issue.path.join('.') : 'type',
      message: issue.message,
    })),
  };
}

/** Prefill the form from an existing transaction, for the edit flow. */
export function draftFromTransaction(transaction: TransactionResponse): TransactionDraft {
  return {
    type: transaction.type,
    amount: transaction.amount,
    currency: transaction.currency,
    fromAccountId: transaction.fromAccount?.id ?? null,
    toAccountId: transaction.toAccount?.id ?? null,
    categoryId: transaction.category?.id ?? null,
    description: transaction.description ?? '',
    reference: transaction.reference ?? '',
    transactionDate: transaction.transactionDate,
    status: transaction.status,
  };
}

/**
 * Does this draft move money between two people's wallets?
 *
 * Worth its own warning in the UI: the API demands EDITOR on both wallets and
 * the entry will show up in someone else's ledger, which is not what a user
 * picking from one long account list necessarily expects.
 */
export function isCrossWalletDraft(
  draft: TransactionDraft,
  walletIdOfAccount: (accountId: string) => string | undefined,
): boolean {
  if (draft.type !== TransactionType.TRANSFER) return false;
  if (draft.fromAccountId === null || draft.toAccountId === null) return false;
  const from = walletIdOfAccount(draft.fromAccountId);
  const to = walletIdOfAccount(draft.toAccountId);
  if (from === undefined || to === undefined) return false;
  return from !== to;
}
