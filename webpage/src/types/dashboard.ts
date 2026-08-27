/**
 * Dashboard read models for DASH-US-01.
 * Field names follow the SRS §1.4 / SDS §2.1 domain terminology.
 */

/** Matches the values the API serialises — the backend TransactionType enum. */
export type TransactionType =
  | 'INCOME'
  | 'EXPENSE'
  | 'TRANSFER'
  | 'REFUND'
  | 'INVESTMENT'
  | 'LOAN'
  | 'DEBT'

export interface RecentTransaction {
  id: number
  date: string
  type: TransactionType
  amount: number
  category?: string
  account?: string
  description?: string
}

export interface BudgetProgressItem {
  id: number
  name: string
  category?: string
  allocated: number
  spent: number
}

export interface UpcomingBill {
  id: number
  name: string
  category?: string
  amount: number
  dueDate: string
}

/**
 * Metric values are null until the workspace has data to compute them from,
 * which the dashboard renders as an empty state rather than a misleading zero.
 */
export interface DashboardMetrics {
  totalBalance: number | null
  monthlyIncome: number | null
  monthlyExpense: number | null
  cashFlow: number | null
  netWorth: number | null
  savingsProgressPercent: number | null
}

/**
 * Income, expense and net for one grain — a period, a day, or an account.
 * Every figure is already in the workspace preferred currency (BR-07a).
 */
export interface FlowStats {
  income: number
  expense: number
  net: number
}

/** A point in the daily or monthly series. `period` is an ISO date. */
export interface FlowPoint extends FlowStats {
  period: string
}

export interface AccountStats extends FlowStats {
  id: number
  name: string
  type: string
  currency: string
  status: string
  /** Balance in the account's own currency. */
  balance: number
  /** The same balance converted with the account's snapshot rate. */
  baseBalance: number
}

/** Everything GET /workspaces/{id}/dashboard returns, camel-cased. */
export interface DashboardSummary {
  currency: string
  asOf: string
  totalBalance: number
  allTime: FlowStats
  month: FlowPoint
  today: FlowPoint
  accounts: AccountStats[]
  monthlySeries: FlowPoint[]
  dailySeries: FlowPoint[]
}

export interface DashboardData {
  metrics: DashboardMetrics
  summary: DashboardSummary | null
  recentTransactions: RecentTransaction[]
  budgets: BudgetProgressItem[]
  upcomingBills: UpcomingBill[]
}
