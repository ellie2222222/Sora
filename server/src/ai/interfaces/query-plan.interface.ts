import type { GroupBy, IntentType } from './intent.interface.ts';

export type QueryOperation =
  | 'SPENDING_SUMMARY'
  | 'INCOME_SUMMARY'
  | 'CASH_FLOW_SUMMARY'
  | 'CATEGORY_BREAKDOWN'
  | 'BUDGET_STATUS'
  | 'GOAL_STATUS'
  | 'TRANSACTION_SEARCH'
  | 'FINANCIAL_ADVICE'
  | 'GENERAL_CHAT'
  | 'CLARIFICATION_NEEDED'
  | 'UNSUPPORTED';

export interface ResolvedDateRange {
  startDate: string; // YYYY-MM-DD
  endDate: string; // YYYY-MM-DD
  timeZone: string;
}

export interface QueryPlanFilters {
  categoryId: string | null;
  categoryName: string | null;
  keyword: string | null;
}

/**
 * Validated operation backend will execute.
 * Resolves dates deterministically using the wallet's timezone and validates entities.
 */
export interface QueryPlan {
  originalIntent: IntentType;
  operation: QueryOperation;
  walletId: string;
  timeZone: string;
  dateRange: ResolvedDateRange | null;
  groupBy: GroupBy;
  filters: QueryPlanFilters;
  missingInformation: string[];
}

