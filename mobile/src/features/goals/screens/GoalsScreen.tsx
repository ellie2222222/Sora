import { Plus, Target } from 'lucide-react-native';
import { FlatList, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import type { GoalResponse } from '@sora/contracts';

import { AnimatedScreen, Card, ListItemEnter, Money, ProgressBar, StateView, Text } from '../../../components';
import { SkeletonList } from '../../../components/Skeleton';
import { useModal } from '../../../app/providers/ModalProvider';
import { useTheme } from '../../../app/providers/ThemeProvider';
import { useWallets } from '../../../app/providers/WalletProvider';
import { WalletContextBar } from '../../wallets/components/WalletContextBar';
import { useListGoalsQuery } from '../../../app/store/api/goalsApi';
import type { MainTabScreenProps } from '../../../app/navigation/types';

export function GoalsScreen({ navigation }: MainTabScreenProps<'Goals'>) {
  const theme = useTheme();
  const { t } = useTranslation();
  const { openModal } = useModal();
  const { activeWalletId, permissions } = useWallets();
  const onManage = () => navigation.getParent()?.navigate('WalletList');

  const goals = useListGoalsQuery(
    { walletId: activeWalletId ?? '', status: 'ACTIVE' },
    { skip: activeWalletId === null },
  );

  const renderContent = () => {
    if (activeWalletId === null || goals.isLoading) {
      return <SkeletonList rows={4} rowHeight={110} />;
    }
    if (goals.isError) {
      return <StateView variant="error" error={goals.error} retryAction={() => void goals.refetch()} testID="goals-error" />;
    }

    const items = goals.data ?? [];
    if (items.length === 0) {
      return (
        <StateView
          variant="empty"
          icon={Target}
          title={t('goals.noGoalsTitle')}
          message={t('goals.noGoalsMessage')}
          primaryAction={
            permissions.canWrite
              ? { label: t('goals.newGoal'), onPress: () => openModal('AddGoal'), icon: Plus }
              : undefined
          }
          testID="goals-empty"
        />
      );
    }

    return (
      <FlatList
        testID="goals-list"
        data={items}
        keyExtractor={(item) => item.id}
        contentContainerStyle={{ padding: theme.spacing.md, gap: theme.spacing.md }}
        renderItem={({ item }) => (
          <ListItemEnter>
            <GoalCard goal={item} onPress={() => navigation.getParent()?.navigate('GoalDetail', { goalId: item.id })} />
          </ListItemEnter>
        )}
      />
    );
  };

  return (
    <AnimatedScreen>
      <WalletContextBar onManage={onManage}>
        {renderContent()}
      </WalletContextBar>
    </AnimatedScreen>
  );
}

function GoalCard({ goal, onPress }: { goal: GoalResponse; onPress: () => void }) {
  const theme = useTheme();
  const { t } = useTranslation();

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

