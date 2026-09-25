/**
 * Transactions (§11 of the API specification) — the central ledger entity.
 *
 * Direction comes from `type` plus which account side is set, never from a sign
 * on `amount` (VL-04). `amount`/`type`/`fromAccountId`/`toAccountId` are
 * immutable once recorded (BR-03): a movement of money is a historical fact,
 * and every balance, budget and goal figure is derived from it.
 *
 * Authorization for every write goes through
 * `WalletAccessService#requireAccountsWritable` rather than a bespoke check —
 * it already resolves EDITOR-or-above on every named account's wallet (the
 * cross-wallet transfer rule, §2.5).
 */

import { Injectable, type PipeTransform } from '@nestjs/common';
import type { Kysely, Transaction } from 'kysely';

import {
  TransactionStatus,
  TransactionType,
  AccountStatus,
  CategoryType,
  type CategoryResponse,
  type CreateTransactionRequest,
  type TransactionAccountRef,
  type TransactionQuery,
  type TransactionResponse,
  type UpdateTransactionRequest,
} from '@sora/contracts';

import { AUDIT_EVENTS, ENTITY_TYPES } from '../audit/audit-events.ts';
import { AuditService } from '../audit/audit.service.ts';
import { AppError } from '../common/app-error.ts';
import type { AuthenticatedUser } from '../common/decorators.ts';
import { Enveloped, paginated } from '../common/envelope.ts';
import { paginationMeta, parseSort } from '../common/pagination.ts';
import { DatabaseService } from '../database/database.service.ts';
import type { DB } from '../database/types.ts';
import { AccountAccess, WalletAccessService } from '../wallets/wallet-access.service.ts';
import { assertCategoryFits, assertCategoryRemovable, categorisedAccountId, type CategoryFacts } from './transaction-category.ts';

export interface DeleteTransactionRequest {
  reason?: string;
}

type Executor = Kysely<DB> | Transaction<DB>;

/**
 * Not in `updateTransactionSchema` at all, so any attempt to set them must be
 * caught against the raw body before Zod strips them silently (BR-03).
 */
const IMMUTABLE_FIELDS = ['amount', 'type', 'fromAccountId', 'toAccountId'] as const;

/**
 * BR-03, checked on the raw body ahead of the schema pipe: the schema strips these fields,
 * so after it an attempted change would read as an empty update (422) instead of 409.
 */
export const rejectImmutableFieldsPipe: PipeTransform = {
  transform(value: unknown) {
    const raw = (value ?? {}) as Record<string, unknown>;
    const attempted = IMMUTABLE_FIELDS.filter((field) => field in raw);
    if (attempted.length > 0) {
      throw new AppError(
        'TRANSACTION_IMMUTABLE',
        undefined,
        Object.fromEntries(attempted.map((field) => [field, ['Cannot be changed after creation']])),
      );
    }
    return value;
  },
};

const SORT_ALLOWLIST: Record<string, string> = {
  transactionDate: 'transactions.transaction_date',
  amount: 'transactions.amount',
  createdAt: 'transactions.created_at',
};

interface TransactionRow {
  id: string;
  created_by_user_id: string;
  from_account_id: string | null;
  to_account_id: string | null;
  category_id: string | null;
  type: TransactionType;
  amount: string;
  currency: string;
  description: string | null;
  transaction_date: Date;
  status: TransactionStatus;
  reference: string | null;
  created_at: Date;
  updated_at: Date;
}

interface CategoryRow {
  id: string;
  wallet_id: string;
  type: CategoryType;
  name: string;
  icon: string | null;
  color: string | null;
}

interface TransactionJoinRow {
  id: string;
  type: TransactionType;
  status: TransactionStatus;
  amount: string;
  currency: string;
  description: string | null;
  transaction_date: Date;
  reference: string | null;
  created_at: Date;
  updated_at: Date;
  created_by_user_id: string;
  created_by_display_name: string;
  from_account_id: string | null;
  from_account_name: string | null;
  from_account_currency: string | null;
  from_wallet_id: string | null;
  from_wallet_name: string | null;
  to_account_id: string | null;
  to_account_name: string | null;
  to_account_currency: string | null;
  to_wallet_id: string | null;
  to_wallet_name: string | null;
  category_id: string | null;
  category_name: string | null;
  category_type: CategoryType | null;
  category_icon: string | null;
  category_color: string | null;
}

const TRANSACTION_COLUMNS = [
  'transactions.id as id',
  'transactions.type as type',
  'transactions.status as status',
  'transactions.amount as amount',
  'transactions.currency as currency',
  'transactions.description as description',
  'transactions.transaction_date as transaction_date',
  'transactions.reference as reference',
  'transactions.created_at as created_at',
  'transactions.updated_at as updated_at',
  'transactions.created_by_user_id as created_by_user_id',
  'creator.display_name as created_by_display_name',
  'from_account.id as from_account_id',
  'from_account.name as from_account_name',
  'from_account.currency as from_account_currency',
  'from_wallet.id as from_wallet_id',
  'from_wallet.name as from_wallet_name',
  'to_account.id as to_account_id',
  'to_account.name as to_account_name',
  'to_account.currency as to_account_currency',
  'to_wallet.id as to_wallet_id',
  'to_wallet.name as to_wallet_name',
  'txn_category.id as category_id',
  'txn_category.name as category_name',
  'txn_category.type as category_type',
  'txn_category.icon as category_icon',
  'txn_category.color as category_color',
] as const;

@Injectable()
export class TransactionsService {
  constructor(
    private readonly database: DatabaseService,
    private readonly access: WalletAccessService,
    private readonly audit: AuditService,
  ) {}

  private executor(given?: Executor): Executor {
    return given ?? this.database.db;
  }

  /**
   * Joins both account sides to their wallets and the creator, so a list or a
   * detail read needs one query rather than one plus a per-row lookup.
   */
  private joinedQuery(executor?: Executor) {
    return this.executor(executor)
      .selectFrom('transactions')
      .leftJoin('accounts as from_account', 'from_account.id', 'transactions.from_account_id')
      .leftJoin('wallets as from_wallet', 'from_wallet.id', 'from_account.wallet_id')
      .leftJoin('accounts as to_account', 'to_account.id', 'transactions.to_account_id')
      .leftJoin('wallets as to_wallet', 'to_wallet.id', 'to_account.wallet_id')
      .leftJoin('categories as txn_category', 'txn_category.id', 'transactions.category_id')
      .innerJoin('users as creator', 'creator.id', 'transactions.created_by_user_id');
  }

  private async loadJoined(
    transactionId: string,
    executor?: Executor,
  ): Promise<TransactionJoinRow | undefined> {
    return this.joinedQuery(executor)
      .select(TRANSACTION_COLUMNS)
      .where('transactions.id', '=', transactionId)
      .executeTakeFirst();
  }

  private async toResponse(transactionId: string, executor?: Executor): Promise<TransactionResponse> {
    const row = await this.loadJoined(transactionId, executor);
    if (!row) throw new AppError('TRANSACTION_NOT_FOUND');
    return toTransactionResponse(row);
  }

  private async plainRow(transactionId: string, executor?: Executor): Promise<TransactionRow> {
    const row = await this.executor(executor)
      .selectFrom('transactions')
      .selectAll()
      .where('id', '=', transactionId)
      .executeTakeFirst();
    if (!row) throw new AppError('TRANSACTION_NOT_FOUND');
    return row;
  }

  private async categoryRow(categoryId: string, executor?: Executor): Promise<CategoryRow | undefined> {
    return this.executor(executor)
      .selectFrom('categories')
      .select(['id', 'wallet_id', 'type', 'name', 'icon', 'color'])
      .where('id', '=', categoryId)
      .executeTakeFirst();
  }

  private async categoryFacts(categoryId: string, userId: string): Promise<CategoryFacts | undefined> {
    const row = await this.categoryRow(categoryId);
    if (!row) return undefined;
    return { ...row, visibleToCaller: (await this.access.roleOn(userId, row.wallet_id)) !== null };
  }

  private walletIdsTouched(accessMap: Map<string, AccountAccess>): string[] {
    return [...new Set([...accessMap.values()].map((access) => access.walletId))];
  }

  /**
   * Audited once per wallet the transaction touches (LA-02), so a cross-wallet transfer appears in both
   * trails — inside the write's own transaction, so the change and its record commit together.
   */
  private async auditTransaction(
    trx: Transaction<DB>,
    event: (typeof AUDIT_EVENTS)[keyof typeof AUDIT_EVENTS],
    entityId: string,
    actorId: string,
    walletIds: readonly string[],
    ip: string | null,
    note?: string | null,
  ): Promise<void> {
    for (const walletId of walletIds) {
      await this.audit.record(
        {
          event,
          entityType: ENTITY_TYPES.TRANSACTION,
          entityId,
          actorId,
          walletId,
          ip,
          note: note ?? null,
        },
        trx,
      );
    }
  }

  async list(user: AuthenticatedUser, filters: TransactionQuery): Promise<Enveloped<TransactionResponse[]>> {
    const walletIds = filters.walletId
      ? [(await this.access.require(user.id, filters.walletId, 'VIEWER')).walletId]
      : await this.access.accessibleWalletIds(user.id);

    if (walletIds.length === 0) {
      return paginated([], paginationMeta(filters.page, filters.pageSize, 0));
    }

    let builder = this.joinedQuery().where((eb) =>
      eb.or([eb('from_wallet.id', 'in', walletIds), eb('to_wallet.id', 'in', walletIds)]),
    );

    if (filters.accountId) {
      const accountId = filters.accountId;
      builder = builder.where((eb) =>
        eb.or([eb('from_account.id', '=', accountId), eb('to_account.id', '=', accountId)]),
      );
    }
    if (filters.categoryId) builder = builder.where('txn_category.id', '=', filters.categoryId);
    if (filters.type) builder = builder.where('transactions.type', '=', filters.type);
    if (filters.status) builder = builder.where('transactions.status', '=', filters.status);
    if (filters.dateFrom) {
      builder = builder.where('transactions.transaction_date', '>=', new Date(`${filters.dateFrom}T00:00:00.000Z`));
    }
    if (filters.dateTo) {
      builder = builder.where('transactions.transaction_date', '<', dayAfter(filters.dateTo));
    }
    if (filters.minAmount) builder = builder.where('transactions.amount', '>=', filters.minAmount);
    if (filters.maxAmount) builder = builder.where('transactions.amount', '<=', filters.maxAmount);
    if (filters.search) {
      const pattern = `%${filters.search}%`;
      builder = builder.where((eb) =>
        eb.or([eb('transactions.description', 'ilike', pattern), eb('transactions.reference', 'ilike', pattern)]),
      );
    }

    const totalRow = await builder
      .select((eb) => eb.fn.countAll<string>().as('count'))
      .executeTakeFirstOrThrow();
    const total = Number(totalRow.count);

    const sortKeys = parseSort(filters.sortBy, SORT_ALLOWLIST, {
      column: 'transactions.transaction_date',
      direction: 'desc',
    });

    let listQuery = builder.select(TRANSACTION_COLUMNS);
    for (const key of sortKeys) {
      listQuery = listQuery.orderBy(this.database.db.dynamic.ref(key.column), key.direction);
    }
    // A tie on every requested key would otherwise let offset paging repeat or skip a row between pages.
    listQuery = listQuery.orderBy('transactions.id', 'desc');
    listQuery = listQuery.limit(filters.pageSize).offset((filters.page - 1) * filters.pageSize);

    const rows = await listQuery.execute();
    return paginated(rows.map(toTransactionResponse), paginationMeta(filters.page, filters.pageSize, total));
  }

  async create(
    user: AuthenticatedUser,
    request: CreateTransactionRequest,
    ip: string | null,
  ): Promise<TransactionResponse> {
    if (request.type === TransactionType.TRANSFER && request.fromAccountId === request.toAccountId) {
      throw new AppError('TRANSFER_SAME_ACCOUNT');
    }

    const accountIds = accountIdsOf(request);
    const accessMap = await this.access.requireAccountsWritable(user.id, accountIds);

    for (const access of accessMap.values()) {
      if (access.accountStatus === AccountStatus.ARCHIVED) throw new AppError('ACCOUNT_ARCHIVED');
      if (access.currency !== request.currency) throw new AppError('ACCOUNT_CURRENCY_MISMATCH');
    }

    const fromAccess = request.type !== TransactionType.INCOME ? accessMap.get(request.fromAccountId) : undefined;
    const toAccess = request.type !== TransactionType.EXPENSE ? accessMap.get(request.toAccountId) : undefined;

    if (request.type === TransactionType.TRANSFER && fromAccess!.currency !== toAccess!.currency) {
      throw new AppError('TRANSFER_CURRENCY_MISMATCH');
    }

    const categoryId = request.categoryId ?? null;
    if (categoryId !== null) {
      const namedAccountId = categorisedAccountId(
        request.type,
        'fromAccountId' in request ? request.fromAccountId : null,
        'toAccountId' in request ? request.toAccountId : null,
      );
      assertCategoryFits(await this.categoryFacts(categoryId, user.id), request.type, accessMap.get(namedAccountId)!.walletId);
    }

    const row = await this.database.db.transaction().execute(async (trx) => {
      const inserted = await trx
        .insertInto('transactions')
        .values({
          created_by_user_id: user.id,
          from_account_id: request.type === TransactionType.INCOME ? null : request.fromAccountId,
          to_account_id: request.type === TransactionType.EXPENSE ? null : request.toAccountId,
          category_id: categoryId,
          type: request.type,
          amount: request.amount,
          currency: request.currency,
          description: request.description ?? null,
          transaction_date: request.transactionDate,
          status: request.status,
          reference: request.reference ?? null,
        })
        .returningAll()
        .executeTakeFirstOrThrow();

      await this.auditTransaction(
        trx,
        AUDIT_EVENTS.TRANSACTION_CREATED,
        inserted.id,
        user.id,
        this.walletIdsTouched(accessMap),
        ip,
      );
      return inserted;
    });

    return this.toResponse(row.id);
  }

  /**
   * `VIEWER` on either side — a cross-wallet transfer is visible to members of
   * both wallets, and each of them genuinely had money move (§11.1).
   */
  async detail(user: AuthenticatedUser, transactionId: string): Promise<TransactionResponse> {
    const row = await this.loadJoined(transactionId);
    if (!row) throw new AppError('TRANSACTION_NOT_FOUND');
    await this.assertVisible(user, row);
    return toTransactionResponse(row);
  }

  private async assertVisible(
    user: AuthenticatedUser,
    row: { from_wallet_id: string | null; to_wallet_id: string | null },
  ): Promise<void> {
    const walletIds = [row.from_wallet_id, row.to_wallet_id].filter(
      (id): id is string => id !== null,
    );
    const roles = await Promise.all(walletIds.map((walletId) => this.access.roleOn(user.id, walletId)));
    if (roles.every((role) => role === null)) throw new AppError('TRANSACTION_NOT_FOUND');
  }

  async update(
    user: AuthenticatedUser,
    transactionId: string,
    body: UpdateTransactionRequest,
    ip: string | null,
  ): Promise<TransactionResponse> {
    const row = await this.plainRow(transactionId);
    if (row.status === TransactionStatus.DELETED) throw new AppError('TRANSACTION_ALREADY_DELETED');

    const accessMap = await this.access.requireAccountsWritable(user.id, accountIdsOfRow(row));

    if (body.categoryId === null) {
      assertCategoryRemovable(row.type);
    } else if (body.categoryId !== undefined) {
      const namedAccountId = categorisedAccountId(row.type, row.from_account_id, row.to_account_id);
      assertCategoryFits(await this.categoryFacts(body.categoryId, user.id), row.type, accessMap.get(namedAccountId)!.walletId);
    }

    const changedFields = Object.keys(body);

    await this.database.db.transaction().execute(async (trx) => {
      await trx
        .updateTable('transactions')
        .set({
          ...(body.description !== undefined ? { description: body.description } : {}),
          ...(body.transactionDate !== undefined ? { transaction_date: body.transactionDate } : {}),
          ...(body.categoryId !== undefined ? { category_id: body.categoryId } : {}),
          ...(body.reference !== undefined ? { reference: body.reference } : {}),
          updated_at: new Date(),
        })
        .where('id', '=', transactionId)
        .execute();

      await this.auditTransaction(
        trx,
        AUDIT_EVENTS.TRANSACTION_UPDATED,
        transactionId,
        user.id,
        this.walletIdsTouched(accessMap),
        ip,
        changedFields.join(', '),
      );
    });

    return this.toResponse(transactionId);
  }

  async delete(
    user: AuthenticatedUser,
    transactionId: string,
    body: DeleteTransactionRequest,
    ip: string | null,
  ): Promise<TransactionResponse> {
    const row = await this.plainRow(transactionId);
    if (row.status === TransactionStatus.DELETED) throw new AppError('TRANSACTION_ALREADY_DELETED');

    const accessMap = await this.access.requireAccountsWritable(user.id, accountIdsOfRow(row));

    await this.database.db.transaction().execute(async (trx) => {
      await trx
        .updateTable('transactions')
        .set({ status: TransactionStatus.DELETED, updated_at: new Date() })
        .where('id', '=', transactionId)
        .execute();

      // A deleted payment must stop crediting whatever goal it was backing (§11.5).
      await trx.deleteFrom('goal_contributions').where('transaction_id', '=', transactionId).execute();

      await this.auditTransaction(
        trx,
        AUDIT_EVENTS.TRANSACTION_DELETED,
        transactionId,
        user.id,
        this.walletIdsTouched(accessMap),
        ip,
        body.reason ?? null,
      );
    });

    return this.toResponse(transactionId);
  }
}

function accountIdsOf(request: CreateTransactionRequest): string[] {
  if (request.type === TransactionType.INCOME) return [request.toAccountId];
  if (request.type === TransactionType.EXPENSE) return [request.fromAccountId];
  return [request.fromAccountId, request.toAccountId];
}

function accountIdsOfRow(row: TransactionRow): string[] {
  return [row.from_account_id, row.to_account_id].filter((id): id is string => id !== null);
}

function accountRef(row: {
  id: string | null;
  name: string | null;
  currency: string | null;
  walletId: string | null;
  walletName: string | null;
}): TransactionAccountRef | null {
  if (!row.id) return null;
  return {
    id: row.id,
    name: row.name!,
    currency: row.currency!,
    walletId: row.walletId!,
    walletName: row.walletName!,
  };
}

function toTransactionResponse(row: TransactionJoinRow): TransactionResponse {
  const fromAccount = accountRef({
    id: row.from_account_id,
    name: row.from_account_name,
    currency: row.from_account_currency,
    walletId: row.from_wallet_id,
    walletName: row.from_wallet_name,
  });
  const toAccount = accountRef({
    id: row.to_account_id,
    name: row.to_account_name,
    currency: row.to_account_currency,
    walletId: row.to_wallet_id,
    walletName: row.to_wallet_name,
  });

  const category: Pick<CategoryResponse, 'id' | 'name' | 'type' | 'icon' | 'color'> | null = row.category_id
    ? {
        id: row.category_id,
        name: row.category_name!,
        type: row.category_type!,
        icon: row.category_icon,
        color: row.category_color,
      }
    : null;

  return {
    id: row.id,
    type: row.type,
    status: row.status,
    amount: row.amount,
    currency: row.currency,
    description: row.description,
    transactionDate: row.transaction_date.toISOString(),
    reference: row.reference,
    fromAccount,
    toAccount,
    category,
    createdBy: { id: row.created_by_user_id, displayName: row.created_by_display_name },
    // Two accounts sit in different wallets — the one shape a same-wallet id cannot produce.
    isCrossWallet: Boolean(
      row.from_wallet_id && row.to_wallet_id && row.from_wallet_id !== row.to_wallet_id,
    ),
    createdAt: row.created_at.toISOString(),
    updatedAt: row.updated_at.toISOString(),
  };
}

/** Exclusive upper bound for an inclusive calendar-day filter on a TIMESTAMPTZ column. */
function dayAfter(date: string): Date {
  const next = new Date(`${date}T00:00:00.000Z`);
  next.setUTCDate(next.getUTCDate() + 1);
  return next;
}
