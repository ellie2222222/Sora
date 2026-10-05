import { Pressable, View } from 'react-native';
import { useSelector } from 'react-redux';
import { useTranslation } from 'react-i18next';
import type { BudgetResponse } from '@sora/contracts';

import { Card, Money, ProgressBar, Skeleton, SyncStatusDot, Text } from '@/components';
import { useTheme } from '@/app/providers';
import { formatMoneyString } from '@/utils';
import { selectQueueEntryFor } from '@/app/store';

export function BudgetCard({ budget, onPress }: { budget: BudgetResponse; onPress: () => void }) {
  const theme = useTheme();
  const { t } = useTranslation();
  const syncStatus = useSelector(selectQueueEntryFor('budget', budget.id))?.status;

  return (
    <Pressable testID={`row-budget-${budget.id}`} accessibilityRole="button" onPress={onPress}>
      <Card>
        <View className="flex-row items-center justify-between" style={{ marginBottom: theme.spacing.xs }}>
          <View className="flex-row items-center" style={{ gap: theme.spacing.xs }}>
            <Text weight="semibold">{budget.name}</Text>
            <SyncStatusDot status={syncStatus} />
          </View>
          {budget.isOverBudget ? (
            <Text variant="caption" tone="danger">
              {t('budgets.overBudget')}
            </Text>
          ) : null}
        </View>

        <ProgressBar percentage={budget.usagePercentage} danger={budget.isOverBudget} />

        <View className="flex-row justify-between" style={{ marginTop: theme.spacing.sm }}>
          <View className="flex-row" style={{ gap: theme.spacing.xs }}>
            <Money amount={budget.spent} currency={budget.currency} variant="caption" />
            <Text variant="caption" tone="muted">
              /
            </Text>
            <Money amount={budget.amount} currency={budget.currency} variant="caption" />
          </View>
          <Text variant="caption" tone={budget.isOverBudget ? 'danger' : 'muted'} weight="semibold">
            {formatMoneyString(budget.remaining, budget.currency, { signDisplay: 'always' })} {t('budgets.remaining').toLowerCase()}
          </Text>
        </View>
      </Card>
    </Pressable>
  );
}

export function BudgetItemSkeleton() {
  const theme = useTheme();

  return (
    <Card>
      <View className="flex-row items-center justify-between" style={{ marginBottom: theme.spacing.xs }}>
        <Skeleton width={theme.sizes.skeletonWidth.xl} height={theme.sizes.skeletonLine.title} radius={theme.radius.sm} />
      </View>

      <Skeleton width="100%" height={theme.sizes.progressBar.md} radius={theme.radius.sm} />

      <View className="flex-row justify-between" style={{ marginTop: theme.spacing.sm }}>
        <Skeleton width={theme.sizes.skeletonWidth.md} height={theme.sizes.skeletonLine.body} radius={theme.radius.sm} />
        <Skeleton width={theme.sizes.skeletonWidth.sm} height={theme.sizes.skeletonLine.body} radius={theme.radius.sm} />
      </View>
    </Card>
  );
}
