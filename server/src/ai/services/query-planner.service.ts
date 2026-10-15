import { Injectable, Optional } from '@nestjs/common';
import { CategoryStatus, todayIn } from '@sora/contracts';

import { localizedCategoryName } from '../../categories/category-name.ts';
import { DatabaseService } from '../../database/database.service.ts';
import type { WalletAccess } from '../../wallets/wallet-access.service.ts';
import type { Intent, IntentType } from '../interfaces/intent.interface.ts';
import type { QueryOperation, QueryPlan, ResolvedDateRange } from '../interfaces/query-plan.interface.ts';

const OPERATION_MAP: Record<IntentType, QueryOperation> = {
  spending_summary: 'SPENDING_SUMMARY',
  income_summary: 'INCOME_SUMMARY',
  cash_flow_summary: 'CASH_FLOW_SUMMARY',
  category_breakdown: 'CATEGORY_BREAKDOWN',
  budget_status: 'BUDGET_STATUS',
  goal_status: 'GOAL_STATUS',
  transaction_search: 'TRANSACTION_SEARCH',
  financial_advice: 'FINANCIAL_ADVICE',
  general_chat: 'GENERAL_CHAT',
  clarification_needed: 'CLARIFICATION_NEEDED',
  unsupported: 'UNSUPPORTED',
};

@Injectable()
export class QueryPlannerService {
  constructor(@Optional() private readonly database?: DatabaseService) {}

  /**
   * Translates a detected Intent into a validated QueryPlan.
   * Resolves calendar timeframes deterministically using the wallet's timezone.
   */
  async plan(intent: Intent, walletAccess: WalletAccess, now: Date = new Date()): Promise<QueryPlan> {
    const timeZone = walletAccess.timeZone;
    const dateRange = this.resolveDateRange(intent, timeZone, now);

    let categoryId: string | null = null;
    let categoryName = intent.filters.category;

    if (categoryName && this.database) {
      try {
        const catRows = await this.database.db
          .selectFrom('categories')
          .select(['id', 'name', 'system_key'])
          .select(localizedCategoryName('categories').as('localized_name'))
          .where('wallet_id', '=', walletAccess.walletId)
          .where('status', '=', CategoryStatus.ACTIVE)
          .execute();

        const target = categoryName.trim().toLowerCase();
        const matched = catRows.find((c) => {
          const sys = (c.system_key ?? '').toLowerCase();
          const n = c.name.toLowerCase();
          const loc = (c.localized_name ?? '').toLowerCase();
          return (
            sys === target ||
            n === target ||
            loc === target ||
            n.includes(target) ||
            target.includes(n) ||
            loc.includes(target) ||
            target.includes(loc)
          );
        });

        if (matched) {
          categoryId = matched.id;
          categoryName = matched.localized_name || matched.name;
        }
      } catch {
        // Fall back to unmapped category filter
      }
    }

    return {
      originalIntent: intent.intent,
      operation: OPERATION_MAP[intent.intent] ?? 'UNSUPPORTED',
      walletId: walletAccess.walletId,
      timeZone,
      dateRange,
      groupBy: intent.groupBy,
      filters: {
        categoryId,
        categoryName,
        keyword: intent.filters.keyword,
      },
      missingInformation: [...intent.missingInformation],
    };
  }

  /**
   * Resolves dates deterministically using the wallet's IANA timezone and calendar arithmetic.
   */
  resolveDateRange(intent: Intent, timeZone: string, now: Date = new Date()): ResolvedDateRange | null {
    const today = todayIn(timeZone, now);
    const period = intent.period;

    switch (period.type) {
      case 'today':
        return { startDate: today, endDate: today, timeZone };

      case 'yesterday': {
        const y = new Date(`${today}T00:00:00.000Z`);
        y.setUTCDate(y.getUTCDate() - 1);
        const yday = y.toISOString().slice(0, 10);
        return { startDate: yday, endDate: yday, timeZone };
      }

      case 'this_month': {
        const [year, month] = today.split('-').map(Number) as [number, number];
        const start = `${today.slice(0, 7)}-01`;
        const end = new Date(Date.UTC(year, month, 0)).toISOString().slice(0, 10);
        return { startDate: start, endDate: end, timeZone };
      }

      case 'last_month': {
        const [year, month] = today.split('-').map(Number) as [number, number];
        const start = new Date(Date.UTC(year, month - 2, 1)).toISOString().slice(0, 10);
        const end = new Date(Date.UTC(year, month - 1, 0)).toISOString().slice(0, 10);
        return { startDate: start, endDate: end, timeZone };
      }

      case 'last_n_calendar_months': {
        const count = period.count ?? 3;
        const [year, month] = today.split('-').map(Number) as [number, number];
        const start = new Date(Date.UTC(year, month - count, 1)).toISOString().slice(0, 10);
        const end = new Date(Date.UTC(year, month, 0)).toISOString().slice(0, 10);
        return { startDate: start, endDate: end, timeZone };
      }

      case 'rolling_days': {
        const count = period.count ?? 7;
        const d = new Date(`${today}T00:00:00.000Z`);
        d.setUTCDate(d.getUTCDate() - (count - 1));
        const start = d.toISOString().slice(0, 10);
        return { startDate: start, endDate: today, timeZone };
      }

      case 'custom': {
        if (period.startDate && period.endDate) {
          return { startDate: period.startDate, endDate: period.endDate, timeZone };
        }
        if (period.startDate) {
          return { startDate: period.startDate, endDate: today, timeZone };
        }
        return { startDate: `${today.slice(0, 7)}-01`, endDate: today, timeZone };
      }

      case 'not_applicable':
      default:
        // Summary and breakdown requests with unspecified periods default to the current calendar month
        if (
          intent.intent === 'spending_summary' ||
          intent.intent === 'income_summary' ||
          intent.intent === 'cash_flow_summary' ||
          intent.intent === 'category_breakdown'
        ) {
          const [year, month] = today.split('-').map(Number) as [number, number];
          const start = `${today.slice(0, 7)}-01`;
          const end = new Date(Date.UTC(year, month, 0)).toISOString().slice(0, 10);
          return { startDate: start, endDate: end, timeZone };
        }
        return null;
    }
  }
}

