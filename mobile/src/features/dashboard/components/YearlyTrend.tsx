import { useCallback, useState } from 'react';
import { View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { add, amountInCurrency, formatMoney, largestCurrencyTotal, maxOf, parseMoney, percentageOf, ZERO } from '@sora/contracts';
import type { DashboardResponse, Scaled } from '@sora/contracts';

import { SectionLabel, Skeleton, TrendBarChart } from '@/components';
import { useTheme } from '@/app/providers';
import { monthTick, parseDay, type CalendarDay } from '@/utils';

import { monthsOfYear } from '../utils';
import { MonthDataPoint } from './MonthDataPoint';

/** Income against expenses month by month; each bar needs its own month's figures, so this loads behind the year's totals. */
export function YearlyTrend({ walletId, accountId, year }: { walletId: string; accountId: string | null; year: number }) {
  const theme = useTheme();
  const { t } = useTranslation();
  const months = monthsOfYear(year);
  const [byMonth, setByMonth] = useState<Record<CalendarDay, DashboardResponse | undefined>>({});
  const [settled, setSettled] = useState<Record<CalendarDay, boolean>>({});

  const handleMonthSettled = useCallback((month: CalendarDay, data: DashboardResponse | undefined) => {
    setByMonth((current) => (current[month] === data ? current : { ...current, [month]: data }));
    setSettled((current) => (current[month] === true ? current : { ...current, [month]: true }));
  }, []);

  const dataPoints = months.map((month) => (
    <MonthDataPoint key={month} walletId={walletId} accountId={accountId} month={month} onSettled={handleMonthSettled} />
  ));
  if (months.some((month) => settled[month] !== true)) {
    return (
      <>
        {dataPoints}
        <YearlyTrendSkeleton />
      </>
    );
  }

  // The chart has one scale, so every bar is in the currency the year moved most in; others are left out (BR-07).
  const yearTotals = new Map<string, Scaled>();
  for (const total of months.flatMap((month) => [...(byMonth[month]?.income ?? []), ...(byMonth[month]?.expense ?? [])])) {
    yearTotals.set(total.currency, add(yearTotals.get(total.currency) ?? ZERO, parseMoney(total.amount)));
  }
  const currency = largestCurrencyTotal([...yearTotals].map(([code, amount]) => ({ currency: code, amount: formatMoney(amount) })))?.currency ?? '';
  const monthlyIncome = months.map((month) => amountInCurrency(byMonth[month]?.income ?? [], currency));
  const monthlyExpense = months.map((month) => amountInCurrency(byMonth[month]?.expense ?? [], currency));
  // Each bar's height relative to the year's peak, kept in bigint space rather than widening a Scaled into a JS number.
  const yearMax = [...monthlyIncome, ...monthlyExpense].reduce((max, amount) => maxOf(max, amount), ZERO);
  const points = months.map((month, index) => ({
    label: monthTick(parseDay(month).month),
    income: percentageOf(monthlyIncome[index] ?? ZERO, yearMax),
    expense: percentageOf(monthlyExpense[index] ?? ZERO, yearMax),
  }));

  return (
    <>
      {dataPoints}
      <View>
        <View style={{ marginBottom: theme.spacing.sm }}>
          <SectionLabel>{t('dashboard.monthByMonth')}</SectionLabel>
        </View>
        <TrendBarChart points={points} />
      </View>
    </>
  );
}

function YearlyTrendSkeleton() {
  const theme = useTheme();
  const barArea = theme.sizes.chart.height - theme.lineHeight.md;
  return (
    <View>
      <View style={{ marginBottom: theme.spacing.sm }}>
        <Skeleton width={theme.sizes.skeletonWidth.xxl} height={theme.sizes.skeletonLine.label} radius={theme.radius.xs} />
      </View>
      <View className="flex-row items-end" style={{ height: theme.sizes.chart.height, gap: theme.spacing.xs }}>
        {Array.from({ length: 12 }).map((_, i) => (
          <View key={i} className="flex-1 items-center" style={{ gap: theme.spacing.xs }}>
            <View className="flex-row items-end" style={{ height: barArea, gap: theme.spacing.xxs, justifyContent: 'flex-end' }}>
              <Skeleton width={theme.sizes.chart.barWidth} height={barArea * (0.15 + ((i * 17) % 50) / 100)} radius={theme.radius.pill} />
              <Skeleton width={theme.sizes.chart.barWidth} height={barArea * (0.1 + ((i * 23) % 60) / 100)} radius={theme.radius.pill} />
            </View>
            <Skeleton width={theme.sizes.skeletonWidth.xxs} height={theme.sizes.skeletonLine.caption} radius={theme.radius.none} />
          </View>
        ))}
      </View>
    </View>
  );
}
