import { Target } from 'lucide-react-native';
import { FlatList, View } from 'react-native';
import type { GoalResponse } from '@sora/contracts';

import { Card, EmptyState, ErrorState, Money, ProgressBar, Text } from '../../../components/index.ts';
import { SkeletonList } from '../../../components/Skeleton.tsx';
import { useTheme } from '../../../app/providers/ThemeProvider.tsx';
import { useWallets } from '../../../app/providers/WalletProvider.tsx';
import { WalletContextBar } from '../../wallets/components/WalletContextBar.tsx';
import { useListGoalsQuery } from '../../../app/store/api/goalsApi.ts';
import type { MainTabScreenProps } from '../../../app/navigation/types.ts';

export function GoalsScreen({ navigation }: MainTabScreenProps<'Goals'>) {
  const theme = useTheme();
  const { activeWalletId, permissions } = useWallets();
  const onManage = () => navigation.getParent()?.navigate('WalletList');

  const goals = useListGoalsQuery(
    { walletId: activeWalletId ?? '', status: 'ACTIVE' },
    { skip: activeWalletId === null },
  );

  if (activeWalletId === null || goals.isLoading) {
    return (
      <WalletContextBar onManage={onManage}>
        <SkeletonList rows={4} rowHeight={110} />
      </WalletContextBar>
    );
  }
  if (goals.isError) {
    return (
      <WalletContextBar onManage={onManage}>
        <ErrorState error={goals.error} onRetry={() => void goals.refetch()} testID="goals-error" />
      </WalletContextBar>
    );
  }

  const items = goals.data ?? [];

  if (items.length === 0) {
    return (
      <WalletContextBar onManage={onManage}>
        <EmptyState
          icon={Target}
          title="No savings goals"
          description="Set a target and track how close you are."
          actionLabel={permissions.canWrite ? 'Add goal' : undefined}
          onAction={permissions.canWrite ? () => navigation.getParent()?.navigate('AddGoal') : undefined}
          testID="goals-empty"
        />
      </WalletContextBar>
    );
  }

  return (
    <WalletContextBar onManage={onManage}>
      <FlatList
        testID="goals-list"
        data={items}
        keyExtractor={(item) => item.id}
        contentContainerStyle={{ padding: theme.spacing.md, gap: theme.spacing.md }}
        renderItem={({ item }) => (
          <GoalCard goal={item} onPress={() => navigation.getParent()?.navigate('GoalDetail', { goalId: item.id })} />
        )}
      />
    </WalletContextBar>
  );
}

function GoalCard({ goal, onPress }: { goal: GoalResponse; onPress: () => void }) {
  const theme = useTheme();

  return (
    <Card testID={`goal-card-${goal.id}`} onTouchEnd={onPress}>
      <Text weight="semibold" style={{ marginBottom: theme.spacing.xs }}>
        {goal.name}
      </Text>

      <View style={{ flexDirection: 'row', gap: theme.spacing.xs, marginBottom: theme.spacing.sm }}>
        <Money amount={goal.currentAmount} currency={goal.currency} variant="title" />
        <Text variant="title" tone="muted">
          /
        </Text>
        <Money amount={goal.targetAmount} currency={goal.currency} variant="title" style={{ opacity: 0.6 }} />
      </View>

      <ProgressBar percentage={goal.progressPercentage} tone="income" />

      <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: theme.spacing.sm }}>
        <Text variant="caption" tone="muted">
          {goal.progressPercentage.toFixed(0)}% there
        </Text>
        {goal.targetDate !== null ? (
          <Text variant="caption" tone="muted">
            Target: {goal.targetDate}
          </Text>
        ) : null}
      </View>
    </Card>
  );
}
