import { View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { parseMoney, percentageOf } from '@sora/contracts';

import { Skeleton, StateView } from '@/components';
import { useTheme } from '@/app/providers';
import { useGetDashboardSummaryQuery, useListCategoriesQuery } from '@/app/store';
import { emptyReasonFor, formatPeriodLabel, isNetworkError, previousWindow, windowFor, type CalendarDay, type DashboardPeriod } from '@/utils';
import type { MainTabScreenProps } from '@/app/navigation';

import { DashboardEmptyForWallet } from './DashboardEmptyForWallet';
import { BudgetGoalSummary } from './BudgetGoalSummary';
import { DashboardKpis } from './DashboardKpis';
import { CashFlowCard } from './CashFlowCard';
import { CategoryBreakdown } from './CategoryBreakdown';
import { MemberSplit } from './MemberSplit';
import { PeriodInsights } from './PeriodInsights';

type DashboardNavigation = MainTabScreenProps<'Dashboard'>['navigation'];

export function PeriodReport({
  walletId,
  accountId,
  period,
  anchor,
  navigation,
  onOpenBudget,
  onOpenGoal,
  onPreviousPeriod,
}: {
  walletId: string;
  accountId: string | null;
  period: DashboardPeriod;
  anchor: CalendarDay;
  navigation: DashboardNavigation;
  onOpenBudget: (budgetId: string) => void;
  onOpenGoal: (goalId: string) => void;
  onPreviousPeriod: () => void;
}) {
  const theme = useTheme();
  const { t } = useTranslation();

  const scope = accountId ?? undefined;
  const current = useGetDashboardSummaryQuery({ walletId, accountId: scope, ...windowFor(period, anchor) });
  const previous = useGetDashboardSummaryQuery({ walletId, accountId: scope, ...previousWindow(period, anchor) });
  const categories = useListCategoriesQuery({ walletId });

  // `currentData` is empty while a new wallet/account/window loads, where `data` would still hold the old figures.
  if (current.currentData === undefined && current.isFetching) return <PeriodReportSkeleton />;
  if (current.isError && !isNetworkError(current.error)) {
    return (
      <StateView
        variant="error"
        error={current.error}
        retryAction={() => void current.refetch()}
        testID="dashboard-period-error"
      />
    );
  }

  const data = current.currentData;
  if (data === undefined) {
    return <StateView variant="error" error={new Error(t('dashboard.noData', 'Nothing to show yet.'))} />;
  }

  const emptyReason = emptyReasonFor(data);
  if (emptyReason !== null) {
    return (
      <View style={{ flex: 1, gap: theme.spacing.lg }}>
        <DashboardEmptyForWallet
          reason={emptyReason}
          walletId={walletId}
          periodLabel={formatPeriodLabel(period, anchor)}
          onPreviousPeriod={onPreviousPeriod}
        />
        {/* An active budget or goal is worth seeing even in a window that recorded nothing against it. */}
        <BudgetGoalSummary
          budgets={data.activeBudgets}
          goals={data.activeGoals}
          onOpenBudget={onOpenBudget}
          onOpenGoal={onOpenGoal}
        />
      </View>
    );
  }

  const income = data.income[0];
  const net = data.net[0];
  const savingsRate =
    income !== undefined && net !== undefined
      ? percentageOf(parseMoney(net.amount), parseMoney(income.amount), 0)
      : null;

  return (
    <View style={{ gap: theme.spacing.lg }}>
      <DashboardKpis
        income={data.income}
        expense={data.expense}
        net={data.net}
        transferredIn={data.transferredIn}
        transferredOut={data.transferredOut}
        savingsRate={savingsRate}
      />

      <CashFlowCard
        income={data.income}
        expense={data.expense}
        transferredIn={data.transferredIn}
        transferredOut={data.transferredOut}
      />

      <CategoryBreakdown
        slices={data.spendingByCategory}
        previousSlices={previous.currentData?.spendingByCategory ?? []}
        expenseTotal={data.expense[0]}
        categories={categories.currentData ?? []}
        onSelectCategory={(categoryId) =>
          navigation.getParent()?.navigate('Transactions', { categoryId })
        }
      />

      <MemberSplit members={data.spendingByMember} />

      <BudgetGoalSummary
        budgets={data.activeBudgets}
        goals={data.activeGoals}
        onOpenBudget={onOpenBudget}
        onOpenGoal={(goalId) => navigation.getParent()?.navigate('GoalDetail', { goalId })}
      />

      <PeriodInsights data={data} previousData={previous.currentData} savingsRate={savingsRate} periodLabel={formatPeriodLabel(period, anchor)} />
    </View>
  );
}

function PeriodReportSkeleton() {
  const theme = useTheme();
  return (
    <View style={{ gap: theme.spacing.lg }}>
      {/* DashboardKpis */}
      <View style={{ gap: theme.spacing.md }}>
        <View className="flex-row justify-between">
          <View>
            <View style={{ marginBottom: theme.spacing.xs }}><Skeleton width={theme.sizes.skeletonWidth.xs} height={theme.sizes.skeletonLine.label} radius={theme.radius.xs}  /></View>
            <Skeleton width={theme.sizes.skeletonWidth.md} height={theme.sizes.skeletonLine.title} radius={theme.radius.xs} />
          </View>
          <View>
            <View style={{ marginBottom: theme.spacing.xs }}><Skeleton width={theme.sizes.skeletonWidth.xs} height={theme.sizes.skeletonLine.label} radius={theme.radius.xs}  /></View>
            <Skeleton width={theme.sizes.skeletonWidth.md} height={theme.sizes.skeletonLine.title} radius={theme.radius.xs} />
          </View>
          <View>
            <View style={{ marginBottom: theme.spacing.xs }}><Skeleton width={theme.sizes.skeletonWidth.xs} height={theme.sizes.skeletonLine.label} radius={theme.radius.xs}  /></View>
            <Skeleton width={theme.sizes.skeletonWidth.md} height={theme.sizes.skeletonLine.title} radius={theme.radius.xs} />
          </View>
        </View>
        <Skeleton width={theme.sizes.skeletonWidth.xl} height={theme.sizes.skeletonLine.caption} radius={theme.radius.xs} />
      </View>

      {/* CashFlowCard */}
      <View style={{ gap: theme.spacing.sm }}>
        <Skeleton width={theme.sizes.skeletonWidth.md} height={theme.sizes.skeletonLine.label} radius={theme.radius.xs} />
        <View className="flex-row items-end justify-between" style={{ height: theme.sizes.chart.height }}>
          <Skeleton width={theme.sizes.skeletonWidth.xs} height={theme.sizes.chart.height * 0.7} radius={theme.radius.xs} />
          <Skeleton width={theme.sizes.skeletonWidth.xs} height={theme.sizes.chart.height * 0.45} radius={theme.radius.xs} />
          <Skeleton width={theme.sizes.skeletonWidth.xs} height={theme.sizes.chart.height * 0.15} radius={theme.radius.xs} />
          <Skeleton width={theme.sizes.skeletonWidth.xs} height={theme.sizes.chart.height * 0.3} radius={theme.radius.xs} />
        </View>
      </View>

      {/* CategoryBreakdown */}
      <View style={{ gap: theme.spacing.lg }}>
        <View className="items-center" style={{ gap: theme.spacing.md }}>
          <Skeleton width={theme.sizes.chart.largeHeight} height={theme.sizes.chart.largeHeight} radius={theme.radius.pill} />
          <View className="w-full" style={{ gap: theme.spacing.xs }}>
            <Skeleton width="100%" height={theme.sizes.skeletonLine.heading} radius={theme.radius.xs} />
            <Skeleton width="100%" height={theme.sizes.skeletonLine.heading} radius={theme.radius.xs} />
            <Skeleton width="100%" height={theme.sizes.skeletonLine.heading} radius={theme.radius.xs} />
          </View>
        </View>
      </View>
    </View>
  );
}

