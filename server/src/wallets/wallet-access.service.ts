/**
 * The authorization layer. Every wallet-scoped read and write goes through here.
 *
 * Two rules do all the work, and both come from §2.5 of the API specification:
 *
 * 1. A caller with **no membership row** gets `404`, never `403`. A `403`
 *    confirms the resource exists, which tells someone with no access whether a
 *    given wallet or account id is real. `403` is only ever for "you are a
 *    member here, but your role is too low".
 * 2. Rank comparison is `roleSatisfies()` from @sora/contracts — the same
 *    function the app uses to decide whether to show a button — so a guard here
 *    and a disabled control there can never disagree.
 */

import { Injectable } from '@nestjs/common';
import type { Kysely, Transaction } from 'kysely';

import { roleSatisfies, WalletRole, WalletStatus, AccountStatus, MemberStatus } from '@sora/contracts';

import { AppError } from '../common/app-error.ts';
import { DatabaseService } from '../database/database.service.ts';
import type { DB } from '../database/types.ts';

export interface WalletAccess {
  walletId: string;
  walletName: string;
  role: WalletRole;
  ownerUserId: string;
  status: WalletStatus;
  relationLabel: string | null;
  memberId: string;
}

export interface AccountAccess extends WalletAccess {
  accountId: string;
  accountName: string;
  currency: string;
  accountStatus: AccountStatus;
  initialBalance: string;
}

type Executor = Kysely<DB> | Transaction<DB>;

@Injectable()
export class WalletAccessService {
  constructor(private readonly database: DatabaseService) {}

  private executor(given?: Executor): Executor {
    return given ?? this.database.db;
  }

  /** The caller's active role on a wallet, or null when they have no membership. */
  async roleOn(userId: string, walletId: string, executor?: Executor): Promise<WalletRole | null> {
    const row = await this.executor(executor)
      .selectFrom('wallet_members')
      .select('role')
      .where('wallet_id', '=', walletId)
      .where('user_id', '=', userId)
      .where('status', '=', MemberStatus.ACTIVE)
      .executeTakeFirst();

    return row?.role ?? null;
  }

  /**
   * Resolve the wallet and assert the caller's role reaches `required`.
   *
   * Joins membership to the wallet rather than checking them separately, so a
   * wallet id that does not exist and one the caller cannot see produce the
   * identical 404 — with two queries, response timing would separate them.
   */
  async require(
    userId: string,
    walletId: string,
    required: WalletRole,
    executor?: Executor,
  ): Promise<WalletAccess> {
    const row = await this.executor(executor)
      .selectFrom('wallet_members')
      .innerJoin('wallets', 'wallets.id', 'wallet_members.wallet_id')
      .select([
        'wallet_members.id as member_id',
        'wallet_members.role as role',
        'wallet_members.relation_label as relation_label',
        'wallets.id as wallet_id',
        'wallets.name as wallet_name',
        'wallets.owner_user_id as owner_user_id',
        'wallets.status as status',
      ])
      .where('wallet_members.wallet_id', '=', walletId)
      .where('wallet_members.user_id', '=', userId)
      .where('wallet_members.status', '=', MemberStatus.ACTIVE)
      .executeTakeFirst();

    if (!row) throw new AppError('WALLET_NOT_FOUND');
    if (!roleSatisfies(row.role, required)) throw AppError.forbidden(row.role);

    return {
      walletId: row.wallet_id,
      walletName: row.wallet_name,
      role: row.role,
      ownerUserId: row.owner_user_id,
      status: row.status,
      relationLabel: row.relation_label,
      memberId: row.member_id,
    };
  }

  /**
   * As `require`, plus "the wallet is not archived".
   *
   * Used for every EDITOR-level write. An archived wallet stays fully readable —
   * archiving is not deletion — but accepts nothing new (§6.5). Wallet
   * administration itself deliberately does not go through here, or an archived
   * wallet could never be un-archived.
   */
  async requireWritable(
    userId: string,
    walletId: string,
    required: WalletRole,
    executor?: Executor,
  ): Promise<WalletAccess> {
    const access = await this.require(userId, walletId, required, executor);
    if (access.status === WalletStatus.ARCHIVED) throw new AppError('WALLET_ARCHIVED');
    return access;
  }

  /** Every wallet the caller has an active membership on. */
  async accessibleWalletIds(userId: string, executor?: Executor): Promise<string[]> {
    const rows = await this.executor(executor)
      .selectFrom('wallet_members')
      .select('wallet_id')
      .where('user_id', '=', userId)
      .where('status', '=', MemberStatus.ACTIVE)
      .execute();

    return rows.map((row) => row.wallet_id);
  }

  /**
   * Resolve an account and the caller's role on its wallet.
   *
   * `notFound` defaults to ACCOUNT_NOT_FOUND so a caller with no membership sees
   * the account as simply absent — the same reasoning as rule 1 above, applied
   * one level down.
   */
  async requireAccount(
    userId: string,
    accountId: string,
    required: WalletRole,
    executor?: Executor,
  ): Promise<AccountAccess> {
    const row = await this.executor(executor)
      .selectFrom('accounts')
      .innerJoin('wallets', 'wallets.id', 'accounts.wallet_id')
      .leftJoin('wallet_members', (join) =>
        join
          .onRef('wallet_members.wallet_id', '=', 'accounts.wallet_id')
          .on('wallet_members.user_id', '=', userId)
          .on('wallet_members.status', '=', MemberStatus.ACTIVE),
      )
      .select([
        'accounts.id as account_id',
        'accounts.name as account_name',
        'accounts.currency as currency',
        'accounts.status as account_status',
        'accounts.initial_balance as initial_balance',
        'accounts.wallet_id as wallet_id',
        'wallets.name as wallet_name',
        'wallets.owner_user_id as owner_user_id',
        'wallets.status as wallet_status',
        'wallet_members.id as member_id',
        'wallet_members.role as role',
        'wallet_members.relation_label as relation_label',
      ])
      .where('accounts.id', '=', accountId)
      .executeTakeFirst();

    if (!row || row.role === null || row.member_id === null) {
      throw new AppError('ACCOUNT_NOT_FOUND');
    }
    if (!roleSatisfies(row.role, required)) throw AppError.forbidden(row.role);

    return {
      accountId: row.account_id,
      accountName: row.account_name,
      currency: row.currency,
      accountStatus: row.account_status,
      initialBalance: row.initial_balance,
      walletId: row.wallet_id,
      walletName: row.wallet_name,
      role: row.role,
      ownerUserId: row.owner_user_id,
      status: row.wallet_status,
      relationLabel: row.relation_label,
      memberId: row.member_id,
    };
  }

  /**
   * EDITOR (or above) on the wallet of **every** account a transaction names.
   *
   * This is the cross-wallet transfer rule (§2.5), and it is deliberately
   * stricter than a same-wallet transfer: read-only access to a partner's wallet
   * must not let you push money into it. Both sides are resolved before either
   * is judged, so the caller cannot learn which of the two ids was the problem.
   */
  async requireAccountsWritable(
    userId: string,
    accountIds: readonly string[],
    executor?: Executor,
  ): Promise<Map<string, AccountAccess>> {
    const resolved = new Map<string, AccountAccess>();

    for (const accountId of accountIds) {
      if (resolved.has(accountId)) continue;
      const access = await this.requireAccount(userId, accountId, WalletRole.EDITOR, executor);
      if (access.status === WalletStatus.ARCHIVED) throw new AppError('WALLET_ARCHIVED');
      resolved.set(accountId, access);
    }

    return resolved;
  }
}
