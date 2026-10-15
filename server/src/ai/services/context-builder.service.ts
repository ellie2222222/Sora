import { Injectable } from '@nestjs/common';
import {
  REQUIRED_ROLE,
  roleSatisfies,
  TransactionStatus,
  dayRange,
  type CurrencyTotal,
} from '@sora/contracts';

import { localizedCategoryName } from '../../categories/category-name.ts';
import type { AuthenticatedUser } from '../../common/decorators.ts';
import { DashboardService } from '../../dashboard/dashboard.service.ts';
import { DatabaseService } from '../../database/database.service.ts';
import type { WalletAccess } from '../../wallets/wallet-access.service.ts';
import type {
  AiContext,
  BudgetContextItem,
  CategoryBreakdownSlice,
  GoalContextItem,
  TransactionSummaryItem,
  WalletContextMeta,
} from '../interfaces/context.interface.ts';
import type { QueryPlan } from '../interfaces/query-plan.interface.ts';

@Injectable()
export class ContextBuilderService {
  constructor(
    private readonly database: DatabaseService,
    private readonly dashboard: DashboardService,
  ) {}

  /**
   * Assembles minimal, verified context for the LLM using approved server services.
   * Model never receives raw or unconstrained database access.
   */
  async buildContext(
    plan: QueryPlan,
    user: AuthenticatedUser,
    walletAccess: WalletAccess,
    language: string,
  ): Promise<AiContext> {
    const wallet: WalletContextMeta = {
      id: walletAccess.walletId,
      name: walletAccess.walletName,
      role: walletAccess.role,
      canWrite: roleSatisfies(walletAccess.role, REQUIRED_ROLE.WRITE),
      timeZone: walletAccess.timeZone,
    };

    let totals: { income: CurrencyTotal[]; expense: CurrencyTotal[]; net: CurrencyTotal[] } | undefined;
    let categoryBreakdown: CategoryBreakdownSlice[] | undefined;
    let budgets: BudgetContextItem[] | undefined;
    let goals: GoalContextItem[] | undefined;
    let transactions: TransactionSummaryItem[] | undefined;

    switch (plan.operation) {
      case 'SPENDING_SUMMARY':
      case 'INCOME_SUMMARY':
      case 'CASH_FLOW_SUMMARY':
      case 'CATEGORY_BREAKDOWN':
      case 'FINANCIAL_ADVICE': {
        const summary = await this.dashboard.summary(user, {
          walletId: walletAccess.walletId,
          ...(plan.dateRange ? { dateFrom: plan.dateRange.startDate, dateTo: plan.dateRange.endDate } : {}),
        });

        totals = {
          income: summary.income,
          expense: summary.expense,
          net: summary.net,
        };

        let slices: CategoryBreakdownSlice[] = summary.spendingByCategory.map((s) => ({
          categoryName: s.categoryName,
          amount: s.amount,
          percentage: s.percentage,
        }));

        if (plan.filters.categoryName) {
          const target = plan.filters.categoryName.toLowerCase();
          slices = slices.filter((s) => s.categoryName.toLowerCase().includes(target));
        }

        categoryBreakdown = slices;

        if (plan.operation === 'FINANCIAL_ADVICE') {
          budgets = summary.activeBudgets.map((b) => ({
            name: b.name || (b.category?.name ?? (b.goalId ? 'Goal budget' : 'Wallet budget')),
            spent: b.spent,
            amount: b.amount,
            currency: b.currency,
            usagePercentage: b.usagePercentage,
            isOverBudget: b.isOverBudget,
          }));

          goals = summary.activeGoals.map((g) => ({
            name: g.name,
            currentAmount: g.currentAmount,
            targetAmount: g.targetAmount,
            currency: g.currency,
            progressPercentage: g.progressPercentage,
          }));
        }
        break;
      }

      case 'BUDGET_STATUS': {
        const summary = await this.dashboard.summary(user, {
          walletId: walletAccess.walletId,
          ...(plan.dateRange ? { dateFrom: plan.dateRange.startDate, dateTo: plan.dateRange.endDate } : {}),
        });

        budgets = summary.activeBudgets.map((b) => ({
          name: b.name || (b.category?.name ?? (b.goalId ? 'Goal budget' : 'Wallet budget')),
          spent: b.spent,
          amount: b.amount,
          currency: b.currency,
          usagePercentage: b.usagePercentage,
          isOverBudget: b.isOverBudget,
        }));
        break;
      }

      case 'GOAL_STATUS': {
        const summary = await this.dashboard.summary(user, {
          walletId: walletAccess.walletId,
        });

        goals = summary.activeGoals.map((g) => ({
          name: g.name,
          currentAmount: g.currentAmount,
          targetAmount: g.targetAmount,
          currency: g.currency,
          progressPercentage: g.progressPercentage,
        }));
        break;
      }

      case 'TRANSACTION_SEARCH': {
        const accountRows = await this.database.db
          .selectFrom('accounts')
          .select('id')
          .where('wallet_id', '=', walletAccess.walletId)
          .execute();
        const accountIds = accountRows.map((r) => r.id);

        if (accountIds.length === 0) {
          transactions = [];
          break;
        }

        let query = this.database.db
          .selectFrom('transactions')
          .leftJoin('categories', 'categories.id', 'transactions.category_id')
          .select([
            'transactions.id',
            'transactions.transaction_date',
            'transactions.amount',
            'transactions.currency',
            'transactions.type',
            'transactions.description',
            localizedCategoryName('categories').as('category_name'),
          ])
          .where((eb) =>
            eb.or([
              eb('transactions.from_account_id', 'in', accountIds),
              eb('transactions.to_account_id', 'in', accountIds),
            ]),
          )
          .where('transactions.status', '=', TransactionStatus.ACTIVE);

        if (plan.filters.categoryId) {
          query = query.where('transactions.category_id', '=', plan.filters.categoryId);
        }
        if (plan.filters.keyword) {
          query = query.where('transactions.description', 'ilike', `%${plan.filters.keyword}%`);
        }
        if (plan.dateRange) {
          const { start, end } = dayRange(plan.dateRange.startDate, plan.dateRange.endDate, walletAccess.timeZone);
          query = query
            .where('transactions.transaction_date', '>=', start)
            .where('transactions.transaction_date', '<', end);
        }

        const rows = await query
          .orderBy('transactions.transaction_date', 'desc')
          .orderBy('transactions.id', 'desc')
          .limit(20)
          .execute();

        transactions = rows.map((r) => ({
          id: r.id,
          date: new Date(r.transaction_date).toISOString().slice(0, 10),
          amount: r.amount,
          currency: r.currency,
          type: r.type,
          categoryName: r.category_name ?? null,
          description: r.description ?? null,
        }));
        break;
      }

      case 'GENERAL_CHAT':
      case 'CLARIFICATION_NEEDED':
      case 'UNSUPPORTED':
      default:
        break;
    }

    const systemInstructions = this.buildSystemInstructions(plan, language, walletAccess.walletName);

    return {
      wallet,
      language,
      period: plan.dateRange,
      totals,
      categoryBreakdown,
      budgets,
      goals,
      transactions,
      missingInformation: [...plan.missingInformation],
      systemInstructions,
    };
  }

  private buildSystemInstructions(plan: QueryPlan, language: string, walletName: string): string {
    return [
      `You are the AI assistant for wallet "${walletName}".`,
      `Respond accurately and concisely in the user's language (${language}).`,
      `Ground all numbers strictly in the provided context figures. Never invent amounts, balances, or transactions.`,
      `Transfers are not expenses or income. All calculations have already been performed by the verified financial engine.`,
      plan.missingInformation.length > 0
        ? `Politely ask the user to clarify: ${plan.missingInformation.join(', ')}.`
        : '',
    ]
      .filter(Boolean)
      .join('\n');
  }
}

