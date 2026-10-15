import type { CurrencyTotal, WalletRole } from '@sora/contracts';
import type { ResolvedDateRange } from './query-plan.interface.ts';

export interface WalletContextMeta {
  id: string;
  name: string;
  role: WalletRole;
  canWrite: boolean;
  timeZone: string;
}

export interface CategoryBreakdownSlice {
  categoryName: string;
  amount: string;
  percentage: number;
  currency?: string;
}

export interface BudgetContextItem {
  name: string;
  spent: string;
  amount: string;
  currency: string;
  usagePercentage: number;
  isOverBudget: boolean;
}

export interface GoalContextItem {
  name: string;
  currentAmount: string;
  targetAmount: string;
  currency: string;
  progressPercentage: number;
}

export interface TransactionSummaryItem {
  id: string;
  date: string;
  amount: string;
  currency: string;
  type: string;
  categoryName: string | null;
  description: string | null;
}

/**
 * Minimal financial result data supplied to the Gemini LLM.
 * Contains only the ground truth figures fetched by approved server functions.
 */
export interface AiContext {
  wallet: WalletContextMeta;
  language: string;
  period: ResolvedDateRange | null;
  totals?: {
    income: CurrencyTotal[];
    expense: CurrencyTotal[];
    net: CurrencyTotal[];
  };
  categoryBreakdown?: CategoryBreakdownSlice[];
  budgets?: BudgetContextItem[];
  goals?: GoalContextItem[];
  transactions?: TransactionSummaryItem[];
  missingInformation: string[];
  systemInstructions: string;
}
