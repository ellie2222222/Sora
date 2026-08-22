'use client'

import React, { useCallback, useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import { ArrowLeftRight, Scale, Target, Wallet } from 'lucide-react'
import { AppLayout, useCurrentWorkspace } from '@/components/layouts/app-layout'
import { Alert } from '@/components/ui/alert'
import { SkeletonCards } from '@/components/ui/skeleton'
import { ErrorState } from '@/components/ui/state'
import { useLocale } from '@/components/providers/locale-provider'
import { financeApiService } from '@/lib/finance-api.service'
import { useTranslate } from '@/hooks/useTranslate'
import { formatCurrency, formatDate } from '@/lib/format'
import type {
  DashboardData,
  DashboardSummary,
  FlowPoint,
  FlowStats,
} from '@/types/dashboard'
import { AccountBreakdown } from './_components/account-breakdown'
import { FlowStatsCard } from './_components/flow-stats-card'
import { FlowTrend } from './_components/flow-trend'
import { MetricCard } from './_components/metric-card'
import { QuickActions } from './_components/quick-actions'
import { RecentTransactions } from './_components/recent-transactions'
import { BudgetProgressPanel } from './_components/budget-progress'
import { UpcomingBills } from './_components/upcoming-bills'

export const dynamic = 'force-dynamic'

/**
 * Starting shape until the summary lands. Balance, income, expense and cash flow
 * come from the dashboard endpoint (already converted to the preferred currency,
 * BR-07a); net worth and savings progress stay null until goals and liabilities
 * are modelled, and the panels below wait on the budgets and bills APIs.
 */
const EMPTY_DASHBOARD: DashboardData = {
  metrics: {
    totalBalance: null,
    monthlyIncome: null,
    monthlyExpense: null,
    cashFlow: null,
    netWorth: null,
    savingsProgressPercent: null,
  },
  summary: null,
  recentTransactions: [],
  budgets: [],
  upcomingBills: [],
}

const flow = (raw: any): FlowStats => ({
  income: Number(raw?.income ?? 0),
  expense: Number(raw?.expense ?? 0),
  net: Number(raw?.net ?? 0),
})

const point = (raw: any): FlowPoint => ({ ...flow(raw), period: String(raw?.period ?? '') })

/** "July 2026" — the month a flow card covers. */
function monthLabel(period: string, locale: 'en' | 'vi'): string {
  if (!period) return ''
  return new Intl.DateTimeFormat(locale === 'vi' ? 'vi-VN' : 'en-US', {
    month: 'long',
    year: 'numeric',
  }).format(new Date(period))
}

/** Maps the snake_case dashboard payload onto the camelCase read model. */
function toSummary(raw: any): DashboardSummary {
  return {
    currency: String(raw.currency),
    asOf: String(raw.as_of ?? ''),
    totalBalance: Number(raw.total_balance ?? 0),
    allTime: flow(raw.all_time),
    month: point(raw.month),
    today: point(raw.today),
    accounts: (raw.accounts ?? []).map((account: any) => ({
      id: Number(account.id),
      name: String(account.name),
      type: String(account.type),
      currency: String(account.currency),
      status: String(account.status),
      balance: Number(account.balance ?? 0),
      baseBalance: Number(account.base_balance ?? 0),
      ...flow(account),
    })),
    monthlySeries: (raw.monthly_series ?? []).map(point),
    dailySeries: (raw.daily_series ?? []).map(point),
  }
}

function DashboardContent() {
  const workspace = useCurrentWorkspace()
  const { t } = useTranslate()
  const { locale } = useLocale()

  const [data, setData] = useState<DashboardData>(EMPTY_DASHBOARD)
  const [loading, setLoading] = useState(true)
  const [failed, setFailed] = useState(false)

  const load = useCallback(async () => {
    try {
      setLoading(true)
      setFailed(false)
      // The recent-transactions panel reads the transaction list directly rather
      // than duplicating those rows inside the dashboard payload.
      const [dashboardResponse, transactionResponse] = await Promise.all([
        financeApiService.getDashboard(workspace.id),
        financeApiService.listTransactions(workspace.id, { page_size: 10 }),
      ])
      const summary = dashboardResponse.data ? toSummary(dashboardResponse.data) : null
      setData((previous) => ({
        ...previous,
        summary,
        metrics: {
          ...previous.metrics,
          totalBalance: summary?.totalBalance ?? null,
          monthlyIncome: summary?.month.income ?? null,
          monthlyExpense: summary?.month.expense ?? null,
          cashFlow: summary?.month.net ?? null,
        },
        recentTransactions: (transactionResponse.data?.transactions ?? []).map(
          (row: any) => ({
            id: Number(row.id),
            date: String(row.date),
            type: String(row.type),
            amount: Number(row.base_amount ?? row.amount ?? 0),
            category: row.category_name ?? undefined,
            account: row.account_name ?? undefined,
            description: row.description ?? undefined,
          })
        ),
      }))
    } catch {
      setFailed(true)
    } finally {
      setLoading(false)
    }
  }, [workspace.id])

  useEffect(() => {
    load()
  }, [load])

  const { metrics, summary, recentTransactions, budgets, upcomingBills } = data

  const money = (value: number | null) =>
    value === null ? null : formatCurrency(value, workspace.currency, locale)

  const hasNoData =
    metrics.totalBalance === null &&
    recentTransactions.length === 0 &&
    budgets.length === 0 &&
    upcomingBills.length === 0

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-gray-900 dark:text-white">
          {t('dashboard.title')}
        </h1>
        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
          {workspace.name} · {workspace.currency}
        </p>
      </div>

      {loading && <SkeletonCards id="skeleton-dashboard-metrics" count={4} />}
      {failed && (
        <ErrorState message={t('common.error')} onRetry={load} retryLabel={t('common.back')} />
      )}
      {!loading && !failed && hasNoData && (
        <Alert type="info" message={t('dashboard.metricsPending')} />
      )}

      {/* Position: what the workspace is worth right now (SDS §3.2, DASH-US-01) */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard
          id="metric-total-balance"
          label={t('dashboard.totalBalance')}
          value={money(metrics.totalBalance)}
          sublabel={t('dashboard.acrossAccounts')}
          icon={<Wallet className="h-[18px] w-[18px]" />}
        />
        <MetricCard
          id="metric-cash-flow"
          label={t('dashboard.cashFlow')}
          value={money(metrics.cashFlow)}
          sublabel={t('dashboard.thisMonth')}
          tone={
            metrics.cashFlow === null ? 'neutral' : metrics.cashFlow >= 0 ? 'positive' : 'negative'
          }
          icon={<ArrowLeftRight className="h-[18px] w-[18px]" />}
        />
        <MetricCard
          id="metric-net-worth"
          label={t('dashboard.netWorth')}
          value={money(metrics.netWorth)}
          icon={<Scale className="h-[18px] w-[18px]" />}
        />
        <MetricCard
          id="metric-savings-progress"
          label={t('dashboard.savingsProgress')}
          value={
            metrics.savingsProgressPercent === null
              ? null
              : `${Math.round(metrics.savingsProgressPercent)}%`
          }
          icon={<Target className="h-[18px] w-[18px]" />}
        />
      </div>

      {/* Flows at three grains: everything, this month, today. */}
      {summary && (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
          <FlowStatsCard
            id="flow-all-time"
            title={t('dashboard.allTime')}
            sublabel={t('dashboard.allTimeHint')}
            stats={summary.allTime}
            currency={summary.currency}
          />
          <FlowStatsCard
            id="flow-month"
            title={t('dashboard.thisMonth')}
            sublabel={monthLabel(summary.month.period, locale)}
            stats={summary.month}
            currency={summary.currency}
          />
          <FlowStatsCard
            id="flow-today"
            title={t('common.today')}
            sublabel={formatDate(summary.today.period, locale)}
            stats={summary.today}
            currency={summary.currency}
          />
        </div>
      )}

      {summary && (
        <FlowTrend
          monthly={summary.monthlySeries}
          daily={summary.dailySeries}
          currency={summary.currency}
        />
      )}

      {summary && (
        <AccountBreakdown
          accounts={summary.accounts}
          currency={summary.currency}
          workspaceId={workspace.id}
        />
      )}

      <QuickActions />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <RecentTransactions
            transactions={recentTransactions}
            currency={workspace.currency}
          />
        </div>
        <div className="space-y-6">
          <BudgetProgressPanel budgets={budgets} currency={workspace.currency} />
          <UpcomingBills bills={upcomingBills} currency={workspace.currency} />
        </div>
      </div>
    </div>
  )
}

export default function WorkspaceDashboardPage() {
  const params = useParams()
  const workspaceId = Number(params.id)
  const { t } = useTranslate()

  return (
    <AppLayout workspaceId={workspaceId} activeKey="dashboard" breadcrumb={t('nav.dashboard')}>
      <DashboardContent />
    </AppLayout>
  )
}
