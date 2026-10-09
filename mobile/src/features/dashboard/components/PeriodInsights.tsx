import { View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { changeAgainst } from '@/utils';
import { SectionLabel, Text } from '@/components';
import { useTheme } from '@/app/providers';
import type { DashboardResponse } from '@sora/contracts';

export function PeriodInsights({
  data,
  previousData,
  periodLabel,
}: {
  data: DashboardResponse;
  previousData: DashboardResponse | undefined;
  periodLabel: string;
}) {
  const theme = useTheme();
  const { t } = useTranslation();

  const lines: string[] = [];
  const topCategory = data.spendingByCategory[0];

  if (topCategory !== undefined) {
    lines.push(
      t('dashboard.biggestExpense', {
        category: topCategory.categoryName,
        percentage: topCategory.percentage.toFixed(0),
      }),
    );

    const previousSlice = previousData?.spendingByCategory.find(
      (slice) => slice.categoryId === topCategory.categoryId,
    );
    if (previousSlice !== undefined) {
      const change = changeAgainst(topCategory.amount, previousSlice.amount);
      if (change !== null && Math.abs(change) >= 5) {
        lines.push(
          t('dashboard.spendingChangedPeriod', {
            category: topCategory.categoryName,
            direction: change >= 0 ? t('dashboard.increased') : t('dashboard.decreased'),
            change: Math.abs(change),
          }),
        );
      }
    }
  }

  if (lines.length === 0) return null;

  return (
    <View style={{ gap: theme.spacing.xs }}>
      <SectionLabel>{t('dashboard.insightsFor', { period: periodLabel })}</SectionLabel>
      {lines.map((line) => (
        <Text key={line}>{line}</Text>
      ))}
    </View>
  );
}
