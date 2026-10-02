/**
 * The local ledger for guest mode.
 *
 * In guest mode there is no server, so this store plays the role Postgres
 * plays for an authenticated user — the one place guest data lives, not a
 * cache of something else (MB-02's rule against mirroring API data does
 * not apply: there is no API to mirror). Mirrors `SessionManager`'s shape
 * (subscribe/current/hydrate/clear) for the same reason that shape works
 * there — a long-lived singleton with no React dependency, directly
 * unit-testable.
 *
 * The whole dataset is persisted as one JSON blob on every mutation. A
 * personal wallet's worth of records is small enough that this is cheaper
 * than a real diffing store, and it means a change can never be applied to
 * memory and then lost to persistence separately.
 *
 * Persistence is injected rather than imported, for the same reason
 * `SessionManager` takes a `SessionPersistence`: nothing here touches React
 * Native, so the class is directly unit-testable under bare `node --test`.
 * The AsyncStorage-backed singleton lives in `guestStorage.ts`.
 */

import type {
  AccountStatus,
  AccountType,
  BudgetPeriodType,
  BudgetStatus,
  CategoryStatus,
  CategoryType,
  GoalStatus,
  MoneyString,
  TransactionStatus,
  TransactionType,
} from '@sora/contracts';

export interface GuestWallet {
  id: string;
  name: string;
  createdAt: string;
  updatedAt: string;
}

export interface GuestAccount {
  id: string;
  walletId: string;
  name: string;
  type: AccountType;
  currency: string;
  initialBalance: MoneyString;
  status: AccountStatus;
  createdAt: string;
  updatedAt: string;
}

export interface GuestCategory {
  id: string;
  walletId: string;
  parentId: string | null;
  name: string;
  type: CategoryType;
  icon: string | null;
  color: string | null;
  status: CategoryStatus;
  createdAt: string;
  updatedAt: string;
}

export interface GuestTransaction {
  id: string;
  type: TransactionType;
  status: TransactionStatus;
  amount: MoneyString;
  currency: string;
  description: string | null;
  transactionDate: string;
  reference: string | null;
  fromAccountId: string | null;
  toAccountId: string | null;
  categoryId: string | null;
  goalId: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface GuestBudget {
  id: string;
  walletId: string;
  categoryId: string | null;
  goalId: string | null;
  name: string;
  amount: MoneyString;
  currency: string;
  periodType: BudgetPeriodType;
  startDate: string;
  endDate: string;
  status: BudgetStatus;
  createdAt: string;
  updatedAt: string;
}

export interface GuestGoal {
  id: string;
  walletId: string;
  name: string;
  description: string | null;
  targetAmount: MoneyString;
  currency: string;
  targetDate: string | null;
  status: GoalStatus;
  createdAt: string;
  updatedAt: string;
}

export interface GuestContribution {
  id: string;
  goalId: string;
  accountId: string;
  transactionId: string | null;
  amount: MoneyString;
  currency: string;
  contributionDate: string;
  note: string | null;
  createdAt: string;
}

/**
 * Ids already uploaded to the server, and the idempotency keys pinned to a
 * money-moving create. Persisting both is what makes a resumed upload after
 * an app kill safe: it neither re-creates an already-uploaded row nor mints
 * a new key that would let a retried transaction/contribution record the
 * same money twice.
 */
export interface GuestUploadProgress {
  walletId: string;
  categoryMap: Record<string, string>;
  accountMap: Record<string, string>;
  transactionMap: Record<string, string>;
  budgetMap: Record<string, string>;
  goalMap: Record<string, string>;
  contributionMap: Record<string, string>;
  categoryKeys: Record<string, string>;
  accountKeys: Record<string, string>;
  transactionKeys: Record<string, string>;
  budgetKeys: Record<string, string>;
  goalKeys: Record<string, string>;
  contributionKeys: Record<string, string>;
}

export interface GuestData {
  wallet: GuestWallet | null;
  accounts: GuestAccount[];
  categories: GuestCategory[];
  transactions: GuestTransaction[];
  budgets: GuestBudget[];
  goals: GuestGoal[];
  contributions: GuestContribution[];
  uploadProgress: GuestUploadProgress | null;
  /** Which STARTER_CATEGORIES_VERSION this wallet was last seeded or backfilled to; 0 predates tracking. */
  starterCategoriesVersion: number;
}

function emptyData(): GuestData {
  return {
    wallet: null,
    accounts: [],
    categories: [],
    transactions: [],
    budgets: [],
    goals: [],
    contributions: [],
    uploadProgress: null,
    starterCategoriesVersion: 0,
  };
}

/** Rows saved before a field existed read it as undefined, which `=== null` checks would miss. */
function withStoredDefaults(stored: Partial<GuestData>): GuestData {
  const data = { ...emptyData(), ...stored };
  return {
    ...data,
    transactions: data.transactions.map((transaction) => ({ ...transaction, goalId: transaction.goalId ?? null })),
    budgets: data.budgets.map((budget) => ({ ...budget, goalId: budget.goalId ?? null })),
  };
}

export function emptyUploadProgress(walletId: string): GuestUploadProgress {
  return {
    walletId,
    categoryMap: {},
    accountMap: {},
    transactionMap: {},
    budgetMap: {},
    goalMap: {},
    contributionMap: {},
    categoryKeys: {},
    accountKeys: {},
    transactionKeys: {},
    budgetKeys: {},
    goalKeys: {},
    contributionKeys: {},
  };
}

export type GuestListener = (data: GuestData) => void;

/** The raw-string persistence the store reads and writes its one JSON blob through. */
export interface GuestPersistence {
  load(): Promise<string | null>;
  save(serialized: string): Promise<void>;
  clear(): Promise<void>;
}

export class GuestStore {
  private data: GuestData = emptyData();
  private hydrated = false;
  private hydrating: Promise<GuestData> | null = null;
  /** Bumped by clear/setPersistence, so a read that started before either is discarded. */
  private generation = 0;
  private readonly listeners = new Set<GuestListener>();
  // Assigned in the body rather than as a parameter property: Node's
  // strip-only type stripping, which `npm test` relies on, rejects those.
  private persistence: GuestPersistence;

  constructor(persistence: GuestPersistence) {
    this.persistence = persistence;
  }

  /**
   * Swaps the backing store and returns to a pre-hydration state, the same
   * registration idiom `guestIds.ts` uses for its generator. This is how a
   * test drives the singleton every guest API is wired to, without reaching
   * for AsyncStorage — whose methods do not exist off-device.
   */
  setPersistence(persistence: GuestPersistence): void {
    this.persistence = persistence;
    this.data = emptyData();
    this.hydrated = false;
    this.hydrating = null;
    this.generation += 1;
  }

  private emit(): void {
    for (const listener of this.listeners) listener(this.data);
  }

  subscribe(listener: GuestListener): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  current(): GuestData {
    return this.data;
  }

  hasData(): boolean {
    return this.data.wallet !== null;
  }

  /** Reads whatever the last run persisted, once. Single-flight: it is called from more than
   * one place on startup, and a second read landing late would discard a change. */
  hydrate(): Promise<GuestData> {
    if (this.hydrated) return Promise.resolve(this.data);
    this.hydrating ??= this.load().finally(() => {
      this.hydrating = null;
    });
    return this.hydrating;
  }

  private async load(): Promise<GuestData> {
    const generation = this.generation;
    const raw = await this.persistence.load();
    if (generation !== this.generation || this.hydrated) return this.data;

    if (raw !== null) {
      try {
        this.data = withStoredDefaults(JSON.parse(raw) as Partial<GuestData>);
      } catch {
        this.data = emptyData();
      }
    }
    this.hydrated = true;
    this.emit();
    return this.data;
  }

  async mutate(updater: (data: GuestData) => GuestData): Promise<GuestData> {
    // Before hydration `data` is the empty default, and saving an update of it would overwrite storage.
    await this.hydrate();
    this.data = updater(this.data);
    await this.persistence.save(JSON.stringify(this.data));
    this.emit();
    return this.data;
  }

  async clear(): Promise<void> {
    this.data = emptyData();
    this.hydrated = true;
    this.generation += 1;
    await this.persistence.clear();
    this.emit();
  }
}
