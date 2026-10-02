import { View } from 'react-native';
import { useSelector } from 'react-redux';
import { useTranslation } from 'react-i18next';
import type { GoalResponse } from '@sora/contracts';

import { Card, Money, ProgressBar, SyncStatusDot, Text } from '@/components';
import { useTheme } from '@/app/providers';
import { selectQueueEntryFor } from '@/app/store';

export function GoalCard({ goal, onPress }: { goal: GoalResponse; onPress: () => void }) {
  const theme = useTheme();
  const { t } = useTranslation();
  const syncStatus = useSelector(selectQueueEntryFor('goal', goal.id))?.status;

  return (
    <Card testID={`row-goal-${goal.id}`} onTouchEnd={onPress}>
      <View className="flex-row items-center" style={{ gap: theme.spacing.xs, marginBottom: theme.spacing.xs }}>
        <Text weight="semibold">{goal.name}</Text>
        <SyncStatusDot status={syncStatus} />
      </View>

      <View className="flex-row" style={{ gap: theme.spacing.xs, marginBottom: theme.spacing.sm }}>
        <Money amount={goal.currentAmount} currency={goal.currency} variant="title" />
        <Text variant="title" tone="muted">
          /
        </Text>
        <Money amount={goal.targetAmount} currency={goal.currency} variant="title" style={{ opacity: 0.6 }} />
      </View>

      <ProgressBar percentage={goal.progressPercentage} tone="income" />

      <View className="flex-row justify-between" style={{ marginTop: theme.spacing.sm }}>
        <Text variant="caption" tone="muted">
          {goal.progressPercentage.toFixed(0)}%
        </Text>
        {goal.targetDate !== null ? (
          <Text variant="caption" tone="muted">
            {t('goals.deadline')}: {goal.targetDate}
          </Text>
        ) : null}
      </View>
    </Card>
  );
}
