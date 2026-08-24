import { View } from 'react-native';

import { Card, ErrorState, Money, ProgressBar, Text } from '../../../components/index.ts';
import { SkeletonList } from '../../../components/Skeleton.tsx';
import { useTheme } from '../../../app/providers/ThemeProvider.tsx';
import { useQuery } from '@tanstack/react-query';
import { queryKeys } from '../../../app/config/queryKeys.ts';
import { budgetsApi } from '../../../services/api/budgets.ts';
import type { AppStackScreenProps } from '../../../app/navigation/types.ts';

export function BudgetDetailScreen({ route }: AppStackScreenProps<'BudgetDetail'>) {
  const theme = useTheme();
  const { budgetId } = route.params;

  const budget = useQuery({
    queryKey: queryKeys.budgets.detail(budgetId),
    queryFn: () => budgetsApi.detail(budgetId),
  });

  if (budget.isLoading) return <SkeletonList rows={3} />;
  if (budget.isError) return <ErrorState error={budget.error} onRetry={() => void budget.refetch()} />;

  const data = budget.data;
  if (data === undefined) return null;

  return (
    <View style={{ padding: theme.spacing.md, gap: theme.spacing.md }}>
      <Card>
        <Text variant="title">{data.name}</Text>
        <Text tone="muted" style={{ marginBottom: theme.spacing.sm }}>
          {data.category.name} · {data.startDate} to {data.endDate}
        </Text>

        <ProgressBar percentage={data.usagePercentage} danger={data.isOverBudget} height={12} />

        <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: theme.spacing.md }}>
          <View>
            <Text variant="label" tone="muted">
              Spent
            </Text>
            <Money amount={data.spent} currency={data.currency} variant="title" />
          </View>
          <View style={{ alignItems: 'flex-end' }}>
            <Text variant="label" tone="muted">
              {data.isOverBudget ? 'Over by' : 'Remaining'}
            </Text>
            <Money amount={data.remaining} currency={data.currency} variant="title" />
          </View>
        </View>

        <View style={{ flexDirection: 'row', gap: theme.spacing.xs, marginTop: theme.spacing.sm }}>
          <Text variant="caption" tone="muted">
            Planned:
          </Text>
          <Money amount={data.amount} currency={data.currency} variant="caption" />
        </View>
      </Card>
    </View>
  );
}
