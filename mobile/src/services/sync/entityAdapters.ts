/**
 * One `EntityAdapter` per queueable entity — a thin wrapper over the existing
 * `services/api/<entity>.ts` functions, so `syncEngine.ts` can dispatch a
 * queue row to the right HTTP call without a switch statement per call site.
 *
 * Type-only imports, values pulled in lazily (`defaultApis()`), mirroring
 * `guestUpload.ts`'s `defaultApis()` — the real api modules reach axios and
 * eventually react-native's own Flow-typed entry, which bare `node --test`
 * cannot parse, so this file must stay importable without them.
 */

import type {
  CreateAccountRequest,
  CreateBudgetRequest,
  CreateCategoryRequest,
  CreateGoalRequest,
  CreateTransactionRequest,
  UpdateAccountRequest,
  UpdateBudgetRequest,
  UpdateCategoryRequest,
  UpdateGoalRequest,
  UpdateTransactionRequest,
} from '@sora/contracts';

import type { accountsApi, budgetsApi, categoriesApi, goalsApi, transactionsApi } from '@/services/api';
import type { QueueEntity } from './offlineQueueTypes.ts';

export interface EntityAdapter {
  create(payload: unknown, idempotencyKey: string): Promise<{ id: string }>;
  update(id: string, payload: unknown, idempotencyKey: string): Promise<void>;
  /** Transactions/goals cancel; accounts/budgets/categories archive — same slot either way. */
  cancelOrArchive(id: string, payload: unknown, idempotencyKey: string): Promise<void>;
}

export type EntityAdapters = Record<QueueEntity, EntityAdapter>;

export interface AdapterApis {
  transactions: Pick<typeof transactionsApi, 'create' | 'update' | 'cancel'>;
  accounts: Pick<typeof accountsApi, 'create' | 'update' | 'archive'>;
  budgets: Pick<typeof budgetsApi, 'create' | 'update' | 'archive'>;
  goals: Pick<typeof goalsApi, 'create' | 'cancel'>;
  categories: Pick<typeof categoriesApi, 'create' | 'update' | 'archive'>;
}

async function defaultApis(): Promise<AdapterApis> {
  const [accounts, budgets, categories, goals, transactions] = await Promise.all([
    import('../api/accounts.ts'),
    import('../api/budgets.ts'),
    import('../api/categories.ts'),
    import('../api/goals.ts'),
    import('../api/transactions.ts'),
  ]);

  return {
    transactions: transactions.transactionsApi,
    accounts: accounts.accountsApi,
    budgets: budgets.budgetsApi,
    goals: goals.goalsApi,
    categories: categories.categoriesApi,
  };
}

export function buildEntityAdapters(apis: AdapterApis): EntityAdapters {
  return {
    transaction: {
      async create(payload, key) {
        return apis.transactions.create(payload as CreateTransactionRequest, key);
      },
      async update(id, payload, key) {
        await apis.transactions.update(id, payload as UpdateTransactionRequest, key);
      },
      async cancelOrArchive(id, payload, key) {
        const reason = (payload as { reason?: string } | undefined)?.reason;
        await apis.transactions.cancel(id, reason, key);
      },
    },
    account: {
      async create(payload, key) {
        return apis.accounts.create(payload as CreateAccountRequest, key);
      },
      async update(id, payload, key) {
        await apis.accounts.update(id, payload as UpdateAccountRequest, key);
      },
      async cancelOrArchive(id, _payload, key) {
        await apis.accounts.archive(id, key);
      },
    },
    budget: {
      async create(payload, key) {
        return apis.budgets.create(payload as CreateBudgetRequest, key);
      },
      async update(id, payload, key) {
        await apis.budgets.update(id, payload as UpdateBudgetRequest, key);
      },
      async cancelOrArchive(id, _payload, key) {
        await apis.budgets.archive(id, key);
      },
    },
    goal: {
      async create(payload, key) {
        return apis.goals.create(payload as CreateGoalRequest, key);
      },
      async update() {
        throw new Error('entityAdapters: goal update is not wired to any UI flow yet');
      },
      async cancelOrArchive(id, _payload, key) {
        await apis.goals.cancel(id, key);
      },
    },
    category: {
      async create(payload, key) {
        return apis.categories.create(payload as CreateCategoryRequest, key);
      },
      async update(id, payload, key) {
        await apis.categories.update(id, payload as UpdateCategoryRequest, key);
      },
      async cancelOrArchive(id, _payload, key) {
        await apis.categories.archive(id, key);
      },
    },
  };
}

export async function defaultEntityAdapters(): Promise<EntityAdapters> {
  return buildEntityAdapters(await defaultApis());
}
