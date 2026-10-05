/**
 * Resolves a goal and the caller's role on its wallet in one query, so a goal
 * that does not exist and one the caller cannot see produce the identical
 * 404 — mirroring WalletAccessService.requireAccount, since a goal (and its
 * contributions) are keyed by their own id rather than by the wallet id on
 * the request. Shared by GoalsService and GoalContributionsService so the
 * two can't check this differently.
 */

import { roleSatisfies, MemberStatus, type GoalStatus, type WalletRole } from '@sora/contracts';

import { AppError } from '../common/app-error.ts';
import type { Executor } from '../database/types.ts';

export interface GoalRow {
  id: string;
  wallet_id: string;
  name: string;
  description: string | null;
  target_amount: string;
  currency: string;
  target_date: string | null;
  status: GoalStatus;
  created_at: Date;
  updated_at: Date;
}

export interface GoalAccess {
  goal: GoalRow;
  role: WalletRole;
}

export async function requireGoalAccess(
  db: Executor,
  userId: string,
  goalId: string,
  required: WalletRole,
): Promise<GoalAccess> {
  const found = await db
    .selectFrom('goals')
    .leftJoin('wallet_members', (join) =>
      join
        .onRef('wallet_members.wallet_id', '=', 'goals.wallet_id')
        .on('wallet_members.user_id', '=', userId)
        .on('wallet_members.status', '=', MemberStatus.ACTIVE),
    )
    .select([
      'goals.id as id',
      'goals.wallet_id as wallet_id',
      'goals.name as name',
      'goals.description as description',
      'goals.target_amount as target_amount',
      'goals.currency as currency',
      'goals.target_date as target_date',
      'goals.status as status',
      'goals.created_at as created_at',
      'goals.updated_at as updated_at',
      'wallet_members.role as member_role',
    ])
    .where('goals.id', '=', goalId)
    .executeTakeFirst();

  if (!found || found.member_role === null) throw new AppError('GOAL_NOT_FOUND');
  if (!roleSatisfies(found.member_role, required)) throw AppError.forbidden(found.member_role, found.wallet_id);

  const { member_role, ...goal } = found;
  return { goal, role: member_role };
}

/**
 * A goal named from inside another resource (a budget, an expense's tag) must be one of that
 * wallet's own goals. A goal anywhere else reads as missing (AC-01), whoever can see it.
 */
export async function requireGoalInWallet(db: Executor, walletId: string, goalId: string): Promise<GoalStatus> {
  const goal = await db
    .selectFrom('goals')
    .select('status')
    .where('id', '=', goalId)
    .where('wallet_id', '=', walletId)
    .executeTakeFirst();
  if (!goal) throw new AppError('GOAL_NOT_FOUND');
  return goal.status;
}
