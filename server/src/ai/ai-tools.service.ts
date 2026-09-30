import { Injectable } from '@nestjs/common';
import { AccountStatus, CategoryStatus, formatMoney } from '@sora/contracts';

import { BalanceService } from '../accounts/balance.service.ts';
import type { AuthenticatedUser } from '../common/decorators.ts';
import { DashboardService } from '../dashboard/dashboard.service.ts';
import { DatabaseService } from '../database/database.service.ts';
import type { WalletAccess } from '../wallets/wallet-access.service.ts';
import type { AiToolbox, WalletSnapshot } from './llm-provider.ts';

/**
 * Builds the read-only toolbox for one caller on one wallet. The caller's
 * membership is resolved before this runs (AC-01), and every tool reads only
 * that wallet, so a model cannot be talked into another wallet's data.
 */
@Injectable()
export class AiToolsService {
  constructor(
    private readonly database: DatabaseService,
    private readonly balances: BalanceService,
    private readonly dashboard: DashboardService,
  ) {}

  toolbox(user: AuthenticatedUser, access: WalletAccess): AiToolbox {
    return {
      walletSnapshot: () => this.walletSnapshot(access),
      monthSummary: () => this.dashboard.summary(user, { walletId: access.walletId }),
    };
  }

  private async walletSnapshot(access: WalletAccess): Promise<WalletSnapshot> {
    const [accounts, categories, balances] = await Promise.all([
      this.database.db
        .selectFrom('accounts')
        .select(['id', 'name', 'type', 'currency'])
        .where('wallet_id', '=', access.walletId)
        .where('status', '=', AccountStatus.ACTIVE)
        .orderBy('name')
        .execute(),
      this.database.db
        .selectFrom('categories')
        .select(['id', 'name', 'type'])
        .where('wallet_id', '=', access.walletId)
        .where('status', '=', CategoryStatus.ACTIVE)
        .orderBy('name')
        .execute(),
      this.balances.balancesForWallets([access.walletId]),
    ]);

    return {
      walletId: access.walletId,
      walletName: access.walletName,
      role: access.role,
      status: access.status,
      accounts: accounts.map((account) => {
        const balance = balances.get(account.id);
        return { ...account, balance: balance ? formatMoney(balance.balance) : '0.0000' };
      }),
      categories,
    };
  }
}
