export type IntentType =
  | 'spending_summary'
  | 'income_summary'
  | 'cash_flow_summary'
  | 'category_breakdown'
  | 'budget_status'
  | 'goal_status'
  | 'transaction_search'
  | 'financial_advice'
  | 'general_chat'
  | 'clarification_needed'
  | 'unsupported';

export type PeriodType =
  | 'today'
  | 'yesterday'
  | 'this_month'
  | 'last_month'
  | 'last_n_calendar_months'
  | 'rolling_days'
  | 'custom'
  | 'not_applicable';

export type GroupBy =
  | 'day'
  | 'week'
  | 'month'
  | 'category'
  | 'none';

export interface PeriodIntent {
  type: PeriodType;
  count: number | null;
  startDate: string | null;
  endDate: string | null;
}

export interface IntentFilters {
  category: string | null;
  keyword: string | null;
}

export interface Intent {
  intent: IntentType;
  language: string;
  period: PeriodIntent;
  groupBy: GroupBy;
  filters: IntentFilters;
  missingInformation: string[];
}

