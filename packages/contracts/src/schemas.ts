/**
 * Request validation, defined once and imported by both sides.
 *
 * The API validates with these schemas (authoritative) and the app validates with
 * the same objects for inline form feedback. Sharing the object rather than
 * writing a matching pair is what makes "frontend and backend validation agree"
 * a property of the build instead of a review checklist item.
 *
 * These schemas mirror the CHECK constraints in db/migrations/. The database is the backstop, not
 * the duplicate: it is what still holds when a migration script or a psql
 * session writes without going through the API.
 */

import { z } from 'zod';
import {
  ACCOUNT_STATUSES,
  ACCOUNT_TYPES,
  BUDGET_PERIOD_TYPES,
  BUDGET_STATUSES,
  CATEGORY_STATUSES,
  CATEGORY_TYPES,
  DEFAULT_PAGE_SIZE,
  GOAL_STATUSES,
  INVITABLE_ROLES,
  LOCALES,
  MAX_PAGE_SIZE,
  THEME_NAMES,
  TRANSACTION_STATUSES,
  TRANSACTION_TYPES,
  WALLET_ROLES,
  WALLET_STATUSES,
  TransactionType,
} from './enums.ts';
import { MONEY_SCALE, parseMoney, stripCurrencyInput } from './money.ts';

// ---------------------------------------------------------------------------
// Primitives
// ---------------------------------------------------------------------------

export const uuidSchema = z.string().uuid();

export const currencySchema = z
  .string()
  .regex(/^[A-Z]{3}$/, 'Currency must be a 3-letter uppercase code, e.g. VND');

/**
 * A positive monetary amount as a string.
 *
 * Accepts a number too, because a React Native numeric input yields one, but
 * always normalises to a string so nothing downstream ever holds a float.
 */
export const positiveAmountSchema = z
  .union([z.string(), z.number()])
  .transform((value, ctx) => {
    // Strip thousands separators a UI input may have applied (see
    // formatCurrencyInput/stripCurrencyInput in money.ts) before parsing —
    // MONEY_PATTERN rejects commas, and the raw value must not survive into
    // the returned string either or a comma reaches the database as text.
    const normalized = typeof value === 'string' ? stripCurrencyInput(value) : value;
    try {
      const scaled = parseMoney(normalized);
      if (scaled <= 0n) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Amount must be greater than zero' });
        return z.NEVER;
      }
      return String(normalized);
    } catch {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Amount must be a valid number',
      });
      return z.NEVER;
    }
  });

/** A signed amount — an opening balance may be negative on a credit card. */
export const signedAmountSchema = z
  .union([z.string(), z.number()])
  .transform((value, ctx) => {
    const normalized = typeof value === 'string' ? stripCurrencyInput(value) : value;
    try {
      parseMoney(normalized);
      return String(normalized);
    } catch {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Amount must be a valid number',
      });
      return z.NEVER;
    }
  });

export const isoDateSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'Expected a date as YYYY-MM-DD');

export const isoDateTimeSchema = z.string().datetime({ offset: true });

const nameSchema = (max: number) => z.string().trim().min(1, 'Required').max(max);

// ---------------------------------------------------------------------------
// Auth
// ---------------------------------------------------------------------------

/**
 * Length is the only password rule enforced. Composition rules ("one symbol,
 * one digit") measurably push people toward predictable substitutions, and NIST
 * SP 800-63B advises against them; length plus a breach list is the useful pair.
 */
export const passwordSchema = z
  .string()
  .min(12, 'Password must be at least 12 characters')
  .max(200, 'Password must be at most 200 characters');

export const registerSchema = z.object({
  email: z.string().trim().toLowerCase().email(),
  password: passwordSchema,
  displayName: nameSchema(100),
  baseCurrency: currencySchema.default('VND'),
  locale: z.enum(LOCALES).optional(),
});

export const loginSchema = z.object({
  email: z.string().trim().toLowerCase().email(),
  password: z.string().min(1, 'Required'),
});

export const refreshSchema = z.object({
  refreshToken: z.string().min(1),
});

/** The mobile app never parses the token — the API verifies it against Google's own keys. */
export const googleAuthSchema = z.object({
  idToken: z.string().min(1),
  locale: z.enum(LOCALES).optional(),
});

export const updatePreferencesSchema = z
  .object({
    theme: z.enum(THEME_NAMES).optional(),
    locale: z.enum(LOCALES).optional(),
  })
  .refine((value) => Object.keys(value).length > 0, 'Nothing to update');

// ---------------------------------------------------------------------------
// Wallets & members
// ---------------------------------------------------------------------------

export const createWalletSchema = z.object({
  name: nameSchema(100),
});

export const updateWalletSchema = z
  .object({
    name: nameSchema(100).optional(),
    status: z.enum(WALLET_STATUSES).optional(),
  })
  .refine((value) => Object.keys(value).length > 0, 'Nothing to update');

export const inviteMemberSchema = z.object({
  email: z.string().trim().toLowerCase().email(),
  role: z.enum(INVITABLE_ROLES),
  /** How the invitee refers to this wallet, e.g. "Girlfriend" or "Mom". */
  relationLabel: z.string().trim().max(50).optional(),
});

export const acceptInvitationSchema = z.object({
  token: z.string().min(1),
});

/**
 * Same shape as accepting, kept separate because the two are different requests
 * with different auth (§8.4 is public, §8.5 is not) — collapsing them would put
 * one name on both and make a later divergence a breaking rename.
 */
export const previewInvitationSchema = z.object({
  token: z.string().min(1),
});

export const updateMemberSchema = z.object({
  role: z.enum(WALLET_ROLES),
});

// ---------------------------------------------------------------------------
// Accounts
// ---------------------------------------------------------------------------

export const createAccountSchema = z.object({
  walletId: uuidSchema,
  name: nameSchema(100),
  type: z.enum(ACCOUNT_TYPES),
  currency: currencySchema,
  initialBalance: signedAmountSchema.default('0'),
});

export const updateAccountSchema = z
  .object({
    name: nameSchema(100).optional(),
    currency: currencySchema.optional(),
    status: z.enum(ACCOUNT_STATUSES).optional(),
  })
  .refine((value) => Object.keys(value).length > 0, 'Nothing to update');

// ---------------------------------------------------------------------------
// Categories
// ---------------------------------------------------------------------------

export const createCategorySchema = z.object({
  walletId: uuidSchema,
  parentId: uuidSchema.nullish(),
  name: nameSchema(100),
  type: z.enum(CATEGORY_TYPES),
  icon: z.string().trim().max(50).nullish(),
  color: z.string().trim().max(20).nullish(),
});

export const updateCategorySchema = z
  .object({
    name: nameSchema(100).optional(),
    icon: z.string().trim().max(50).nullish(),
    color: z.string().trim().max(20).nullish(),
    status: z.enum(CATEGORY_STATUSES).optional(),
  })
  .refine((value) => Object.keys(value).length > 0, 'Nothing to update');

// ---------------------------------------------------------------------------
// Transactions
//
// A discriminated union rather than one wide object with conditional refinements:
// the union makes the per-type shape the type system's problem, so a handler that
// has narrowed to EXPENSE cannot reach for a toAccountId that does not exist.
// ---------------------------------------------------------------------------

const transactionCommon = {
  amount: positiveAmountSchema,
  currency: currencySchema,
  description: z.string().trim().max(500).nullish(),
  transactionDate: isoDateTimeSchema,
  status: z.enum(TRANSACTION_STATUSES).default('COMPLETED'),
  reference: z.string().trim().max(100).nullish(),
};

export const createIncomeSchema = z.object({
  type: z.literal('INCOME'),
  toAccountId: uuidSchema,
  categoryId: uuidSchema,
  ...transactionCommon,
});

export const createExpenseSchema = z.object({
  type: z.literal('EXPENSE'),
  fromAccountId: uuidSchema,
  categoryId: uuidSchema,
  ...transactionCommon,
});

export const createTransferSchema = z
  .object({
    type: z.literal('TRANSFER'),
    fromAccountId: uuidSchema,
    toAccountId: uuidSchema,
    // Optional, unlike income/expense: a transfer is neither (BR-06), so labelling one is a choice.
    categoryId: uuidSchema.nullish(),
    ...transactionCommon,
  })
  .refine((value) => value.fromAccountId !== value.toAccountId, {
    message: 'A transfer needs two different accounts',
    path: ['toAccountId'],
  });

export const createTransactionSchema = z.discriminatedUnion('type', [
  createIncomeSchema,
  createExpenseSchema,
  // A discriminated union takes only plain objects, and .innerType() drops the
  // transfer's own-accounts refine, so it is checked again below.
  createTransferSchema.innerType(),
]).superRefine((value, ctx) => {
  if (value.type === TransactionType.TRANSFER && value.fromAccountId === value.toAccountId) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'A transfer needs two different accounts',
      path: ['toAccountId'],
    });
  }
});

/**
 * Editing is restricted to the descriptive fields.
 *
 * Amount, accounts and type are immutable: a recorded movement of money is a
 * historical fact, and rewriting one retroactively changes every balance,
 * budget and goal figure derived from it with no trace. Correcting a real
 * mistake means deleting and re-recording, which leaves both rows visible.
 */
export const updateTransactionSchema = z
  .object({
    description: z.string().trim().max(500).nullish(),
    transactionDate: isoDateTimeSchema.optional(),
    // null removes a transfer's category; the service refuses it for income and expense.
    categoryId: uuidSchema.nullable().optional(),
    reference: z.string().trim().max(100).nullish(),
  })
  .refine((value) => Object.keys(value).length > 0, 'Nothing to update');

export const deleteTransactionSchema = z.object({
  reason: z.string().trim().max(500).optional(),
});

export const transactionQuerySchema = z.object({
  walletId: uuidSchema.optional(),
  accountId: uuidSchema.optional(),
  categoryId: uuidSchema.optional(),
  type: z.enum(TRANSACTION_TYPES).optional(),
  status: z.enum(TRANSACTION_STATUSES).optional(),
  dateFrom: isoDateSchema.optional(),
  dateTo: isoDateSchema.optional(),
  minAmount: positiveAmountSchema.optional(),
  maxAmount: positiveAmountSchema.optional(),
  search: z.string().trim().max(200).optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(MAX_PAGE_SIZE).default(DEFAULT_PAGE_SIZE),
  sortBy: z.string().trim().max(60).default('-transactionDate'),
});

// ---------------------------------------------------------------------------
// Budgets
// ---------------------------------------------------------------------------

export const createBudgetSchema = z
  .object({
    walletId: uuidSchema,
    categoryId: uuidSchema,
    name: nameSchema(100),
    amount: positiveAmountSchema,
    currency: currencySchema,
    periodType: z.enum(BUDGET_PERIOD_TYPES),
    startDate: isoDateSchema,
    endDate: isoDateSchema,
  })
  .refine((value) => value.endDate >= value.startDate, {
    message: 'End date cannot be before start date',
    path: ['endDate'],
  });

export const updateBudgetSchema = z
  .object({
    name: nameSchema(100).optional(),
    amount: positiveAmountSchema.optional(),
    status: z.enum(BUDGET_STATUSES).optional(),
  })
  .refine((value) => Object.keys(value).length > 0, 'Nothing to update');

// ---------------------------------------------------------------------------
// Goals & contributions
// ---------------------------------------------------------------------------

export const createGoalSchema = z.object({
  walletId: uuidSchema,
  name: nameSchema(150),
  description: z.string().trim().max(500).nullish(),
  targetAmount: positiveAmountSchema,
  currency: currencySchema,
  targetDate: isoDateSchema.nullish(),
});

export const updateGoalSchema = z
  .object({
    name: nameSchema(150).optional(),
    description: z.string().trim().max(500).nullish(),
    targetAmount: positiveAmountSchema.optional(),
    targetDate: isoDateSchema.nullish(),
    status: z.enum(GOAL_STATUSES).optional(),
  })
  .refine((value) => Object.keys(value).length > 0, 'Nothing to update');

export const createContributionSchema = z.object({
  accountId: uuidSchema,
  amount: positiveAmountSchema,
  currency: currencySchema,
  contributionDate: isoDateTimeSchema,
  note: z.string().trim().max(500).nullish(),
  /**
   * Records the contribution as real money leaving the account, as an EXPENSE
   * transaction the contribution then points at. Left false, the contribution is
   * an earmark: it advances the goal without asserting the money moved.
   */
  recordAsTransaction: z.boolean().default(false),
  categoryId: uuidSchema.optional(),
});

// ---------------------------------------------------------------------------
// Dashboard
// ---------------------------------------------------------------------------

export const dashboardQuerySchema = z.object({
  walletId: uuidSchema,
  /** Narrows every figure to one of the wallet's accounts; transfers to its sibling accounts then count as in/out. */
  accountId: uuidSchema.optional(),
  dateFrom: isoDateSchema.optional(),
  dateTo: isoDateSchema.optional(),
  displayCurrency: currencySchema.optional(),
});

// ---------------------------------------------------------------------------
// AI assistant
// ---------------------------------------------------------------------------

export const createAiConversationSchema = z.object({
  walletId: uuidSchema.optional(),
  title: nameSchema(150).optional(),
});

export const aiConversationQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(MAX_PAGE_SIZE).default(DEFAULT_PAGE_SIZE),
});

export const sendAiMessageSchema = z.object({
  /** The wallet the question is about; read access is checked on every send. */
  walletId: uuidSchema,
  message: z.string().trim().min(1, 'Required').max(2000),
  locale: z.enum(LOCALES).default('en'),
});

/**
 * What the assistant may propose: an income or an expense in exactly the shape
 * POST /transactions takes, so confirming one is that request and nothing looser.
 */
export const aiTransactionDraftSchema = z.discriminatedUnion('type', [createIncomeSchema, createExpenseSchema]);

// ---------------------------------------------------------------------------
// Inferred request types
// ---------------------------------------------------------------------------

export type RegisterRequest = z.infer<typeof registerSchema>;
export type LoginRequest = z.infer<typeof loginSchema>;
export type RefreshRequest = z.infer<typeof refreshSchema>;
export type GoogleAuthRequest = z.infer<typeof googleAuthSchema>;
export type UpdatePreferencesRequest = z.infer<typeof updatePreferencesSchema>;
export type CreateWalletRequest = z.infer<typeof createWalletSchema>;
export type UpdateWalletRequest = z.infer<typeof updateWalletSchema>;
export type InviteMemberRequest = z.infer<typeof inviteMemberSchema>;
export type AcceptInvitationRequest = z.infer<typeof acceptInvitationSchema>;
export type PreviewInvitationRequest = z.infer<typeof previewInvitationSchema>;
export type UpdateMemberRequest = z.infer<typeof updateMemberSchema>;
export type CreateAccountRequest = z.infer<typeof createAccountSchema>;
export type UpdateAccountRequest = z.infer<typeof updateAccountSchema>;
export type CreateCategoryRequest = z.infer<typeof createCategorySchema>;
export type UpdateCategoryRequest = z.infer<typeof updateCategorySchema>;
export type CreateTransactionRequest = z.infer<typeof createTransactionSchema>;
export type UpdateTransactionRequest = z.infer<typeof updateTransactionSchema>;
export type TransactionQuery = z.infer<typeof transactionQuerySchema>;
export type CreateBudgetRequest = z.infer<typeof createBudgetSchema>;
export type UpdateBudgetRequest = z.infer<typeof updateBudgetSchema>;
export type CreateGoalRequest = z.infer<typeof createGoalSchema>;
export type UpdateGoalRequest = z.infer<typeof updateGoalSchema>;
export type CreateContributionRequest = z.infer<typeof createContributionSchema>;
export type DashboardQuery = z.infer<typeof dashboardQuerySchema>;
export type CreateAiConversationRequest = z.infer<typeof createAiConversationSchema>;
export type AiConversationQuery = z.infer<typeof aiConversationQuerySchema>;
export type SendAiMessageRequest = z.input<typeof sendAiMessageSchema>;
export type AiTransactionDraft = z.output<typeof aiTransactionDraftSchema>;

export const MONEY_DECIMALS = MONEY_SCALE;
