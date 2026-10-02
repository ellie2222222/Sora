import { useCallback, useState } from 'react';
import { View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { maxOf, parseMoney, percentageOf, ZERO } from '@sora/contracts';
import type { DashboardResponse } from '@sora/contracts';

import { Skeleton, Text, TrendBarChart } from '@/components';
import { useTheme } from '@/app/providers';
import { emptyReasonFor, monthName, parseDay, type CalendarDay } from '@/utils';
import type { MainTabScreenProps } from '@/app/navigation';

import { monthsOfYear, yearOf } from '../utils';
import { MonthDataPoint } from './MonthDataPoint';
import { DashboardEmptyForWallet } from './DashboardEmptyForWallet';
import { BudgetGoalSummary } from './BudgetGoalSummary';

type DashboardNavigation = MainTabScreenProps<'Dashboard'>['navigation'];

export function YearlyReport({
  walletId,
  accountId,
  year,
  periodLabel,
  navigation,
  onOpenBudget,
  onOpenGoal,
  onPreviousPeriod,
}: {
  walletId: string;
  accountId: string | null;
  year: number;
  periodLabel: string;
  navigation: DashboardNavigation;
  onOpenBudget: (budgetId: string) => void;
  onOpenGoal: (goalId: string) => void;
  onPreviousPeriod: () => void;
}) {
  const theme = useTheme();
  const { t } = useTranslation();
  const months = monthsOfYear(year);
  const [byMonth, setByMonth] = useState<Record<CalendarDay, DashboardResponse | undefined>>({});
  const [settled, setSettled] = useState<Record<CalendarDay, boolean>>({});

  const handleMonthSettled = useCallback((month: CalendarDay, data: DashboardResponse | undefined) => {
    setByMonth((current) => (current[month] === data ? current : { ...current, [month]: data }));
    setSettled((current) => (current[month] === true ? current : { ...current, [month]: true }));
  }, []);

  const settledCount = months.filter((month) => settled[month] === true).length;
  if (settledCount < months.length) {
    return (
      <>
        {months.map((month) => (
          <MonthDataPoint key={month} walletId={walletId} accountId={accountId} month={month} onSettled={handleMonthSettled} />
        ))}
        <YearlyReportSkeleton />
      </>
    );
  }

  // Every month agrees on the all-time figures the reason is derived from, so
  // the first that loaded answers for the year.
  const anyMonth = months.map((month) => byMonth[month]).find((response) => response !== undefined);
  const emptyReason = anyMonth === undefined ? 'no-accounts' : emptyReasonFor(yearOf(months, byMonth, anyMonth));
  if (emptyReason !== null) {
    return (
      <>
        {months.map((month) => (
          <MonthDataPoint key={month} walletId={walletId} accountId={accountId} month={month} onSettled={handleMonthSettled} />
        ))}
        <DashboardEmptyForWallet
          reason={emptyReason}
          walletId={walletId}
          periodLabel={periodLabel}
          onPreviousPeriod={onPreviousPeriod}
        />
      </>
    );
  }

  const monthlyIncome = months.map((month) => parseMoney(byMonth[month]?.income[0]?.amount ?? '0'));
  const monthlyExpense = months.map((month) => parseMoney(byMonth[month]?.expense[0]?.amount ?? '0'));
  // TrendBarChart only needs each bar's height relative to the year's peak, so
  // that ratio is computed in bigint space (percentageOf) rather than ever
  // widening a Scaled amount into a JS number.
  const yearMax = [...monthlyIncome, ...monthlyExpense].reduce((max, amount) => maxOf(max, amount), ZERO);
  const points = months.map((month, index) => ({
    label: monthName(parseDay(month).month),
    income: percentageOf(monthlyIncome[index] ?? ZERO, yearMax),
    expense: percentageOf(monthlyExpense[index] ?? ZERO, yearMax),
  }));

  const december = byMonth[months[months.length - 1] ?? ''];

  return (
    <>
      {months.map((month) => (
        <MonthDataPoint key={month} walletId={walletId} accountId={accountId} month={month} onSettled={handleMonthSettled} />
      ))}
      <View className="gap-lg">
        <View>
          <Text variant="label" tone="muted" style={{ marginBottom: theme.spacing.sm }}>
            {t('dashboard.incomeVsExpenses')}
          </Text>
          <TrendBarChart points={points} />
        </View>

        {december !== undefined ? (
          <BudgetGoalSummary
            budgets={december.activeBudgets}
            goals={december.activeGoals}
            onOpenBudget={onOpenBudget}
            onOpenGoal={onOpenGoal}
          />
        ) : null}
      </View>
    </>
  );
}

function YearlyReportSkeleton() {
  const theme = useTheme();
  return (
    <View className="gap-lg">
      <View>
        <View style={{ marginBottom: theme.spacing.sm }}><Skeleton width={150} height={16} radius={4}  /></View>
        <View className="flex-row items-end" style={{ height: 140, gap: theme.spacing.xs }}>
          {Array.from({ length: 12 }).map((_, i) => (
            <View key={i} className="flex-1 items-center" style={{ gap: theme.spacing.xs }}>
              <View className="flex-row items-end gap-[3px]" style={{ height: 120, justifyContent: 'flex-end' }}>
                <Skeleton width={6} height={(i * 17) % 60 + 20} radius={theme.radius.pill} />
                <Skeleton width={6} height={(i * 23) % 80 + 10} radius={theme.radius.pill} />
              </View>
              <Skeleton width={20} height={12} radius={2} />
            </View>
          ))}
        </View>
      </View>
      
      <View style={{ gap: theme.spacing.sm }}>
        <Skeleton width={120} height={16} radius={4} />
        <Skeleton width="100%" height={80} radius={8} />
        <Skeleton width="100%" height={80} radius={8} />
      </View>
    </View>
  );
}
