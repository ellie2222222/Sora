import { Pressable, View } from 'react-native';
import { useSelector } from 'react-redux';
import { useTranslation } from 'react-i18next';
import type { GoalResponse } from '@sora/contracts';

import { Card, Money, ProgressBar, Skeleton, SyncStatusDot, Text } from '@/components';
import { useTheme } from '@/app/providers';
import { selectQueueEntryFor } from '@/app/store';

export function GoalCard({ goal, onPress }: { goal: GoalResponse; onPress: () => void }) {
  const theme = useTheme();
  const { t } = useTranslation();
  const syncStatus = useSelector(selectQueueEntryFor('goal', goal.id))?.status;

  return (
    <Pressable testID={`row-goal-${goal.id}`} accessibilityRole="button" onPress={onPress}>
      <Card>
        <View className="flex-row items-center" style={{ gap: theme.spacing.xs, marginBottom: theme.spacing.xs }}>
          <Text weight="semibold">{goal.name}</Text>
          <SyncStatusDot status={syncStatus} />
        </View>

        <View className="flex-row" style={{ gap: theme.spacing.xs, marginBottom: theme.spacing.sm }}>
          <Money amount={goal.currentAmount} currency={goal.currency} variant="title" />
          <Text variant="title" tone="muted">
            /
          </Text>
          <Money amount={goal.targetAmount} currency={goal.currency} variant="title" style={{ opacity: theme.opacity.muted }} />
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
    </Pressable>
  );
}

export function GoalItemSkeleton() {
  const theme = useTheme();

  return (
    <Card>
      <View className="flex-row items-center" style={{ gap: theme.spacing.xs, marginBottom: theme.spacing.xs }}>
        <Skeleton width={theme.sizes.skeletonWidth.lg} height={theme.sizes.skeletonLine.title} radius={theme.radius.sm} />
      </View>

      <View className="flex-row" style={{ gap: theme.spacing.xs, marginBottom: theme.spacing.sm }}>
        <Skeleton width={theme.sizes.skeletonWidth.xxl} height={theme.sizes.skeletonLine.heading} radius={theme.radius.sm} />
      </View>

      <Skeleton width="100%" height={theme.sizes.progressBar.md} radius={theme.radius.sm} />

      <View className="flex-row justify-between" style={{ marginTop: theme.spacing.sm }}>
        <Skeleton width={theme.sizes.skeletonWidth.xs} height={theme.sizes.skeletonLine.body} radius={theme.radius.sm} />
        <Skeleton width={theme.sizes.skeletonWidth.md} height={theme.sizes.skeletonLine.body} radius={theme.radius.sm} />
      </View>
    </Card>
  );
}
