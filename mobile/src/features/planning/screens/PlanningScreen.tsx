import { useState } from 'react';
import { PiggyBank, Plus, Target } from 'lucide-react-native';
import { Pressable, View } from 'react-native';
import { useSelector } from 'react-redux';
import { useTranslation } from 'react-i18next';
import type { BudgetResponse, GoalResponse } from '@sora/contracts';

import { AnimatedScreen, Card, ListItemEnter, Money, ProgressBar, RefreshableFlatList, SkeletonList, StateView, SyncStatusDot, Text } from '@/components';
import { useTheme, useWallets } from '@/app/providers';
import { useModal } from '../../../app/providers/ModalProvider.tsx';
import { WalletContextBar } from '@/features/wallets';
import { today } from '../../../utils/date';
import { formatMoneyString } from '../../../utils/money';
import { isNetworkError } from '../../../utils/errors';
import { selectQueueEntryFor, useListBudgetsQuery, useListGoalsQuery } from '@/app/store';
import type { MainTabScreenProps } from '@/app/navigation';

type PlanningSection = 'budgets' | 'goals';

export function PlanningScreen({ navigation }: MainTabScreenProps<'Planning'>) {
  const theme = useTheme();
  const { t } = useTranslation();
  const { activeWalletId, permissions } = useWallets();
  const { openModal } = useModal();
  const [section, setSection] = useState<PlanningSection>('budgets');
  const [isRefreshing, setIsRefreshing] = useState(false);

  const onManage = () => navigation.getParent()?.navigate('WalletList');

  const budgets = useListBudgetsQuery(
    { walletId: activeWalletId ?? '', status: 'ACTIVE', activeOn: today() },
    { skip: activeWalletId === null },
  );

  const goals = useListGoalsQuery(
    { walletId: activeWalletId ?? '', status: 'ACTIVE' },
    { skip: activeWalletId === null },
  );

  const handleRefresh = async () => {
    setIsRefreshing(true);
    try {
      if (section === 'budgets') {
        await budgets.refetch();
      } else {
        await goals.refetch();
      }
    } finally {
      setIsRefreshing(false);
    }
  };

  const renderBudgetsContent = () => {
    if (activeWalletId === null || budgets.isLoading) {
      return <SkeletonList rows={4} rowHeight={96} />;
    }
    if (budgets.isError && !isNetworkError(budgets.error)) {
      return (
        <StateView
          variant="error"
          error={budgets.error}
          retryAction={() => void budgets.refetch()}
          testID="budgets-error"
        />
      );
    }

    const items = budgets.data ?? [];
    if (items.length === 0) {
      return (
        <StateView
          variant="empty"
          icon={PiggyBank}
          title={t('budgets.noBudgetsTitle')}
          message={t('budgets.noBudgetsMessage')}
          primaryAction={
            permissions.canWrite
              ? { label: t('budgets.newBudget'), onPress: () => openModal('AddBudget'), icon: Plus }
              : undefined
          }
          testID="budgets-empty"
        />
      );
    }

    return (
      <RefreshableFlatList
        testID="budgets-list"
        data={items}
        keyExtractor={(item) => item.id}
        contentContainerStyle={{ padding: theme.spacing.md, gap: theme.spacing.md }}
        refreshing={isRefreshing}
        onRefresh={handleRefresh}
        ListHeaderComponent={
          permissions.canWrite ? (
            <View className="flex-row justify-end" style={{ marginBottom: theme.spacing.sm }}>
              <Pressable testID="budgets-add" onPress={() => openModal('AddBudget')}>
                <Plus size={20} color={theme.colors.primary} />
              </Pressable>
            </View>
          ) : null
        }
        renderItem={({ item }) => (
          <BudgetCard
            budget={item}
            onPress={() => navigation.getParent()?.navigate('BudgetDetail', { budgetId: item.id })}
          />
        )}
      />
    );
  };

  const renderGoalsContent = () => {
    if (activeWalletId === null || goals.isLoading) {
      return <SkeletonList rows={4} rowHeight={110} />;
    }
    if (goals.isError && !isNetworkError(goals.error)) {
      return (
        <StateView
          variant="error"
          error={goals.error}
          retryAction={() => void goals.refetch()}
          testID="goals-error"
        />
      );
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
      <RefreshableFlatList
        testID="goals-list"
        data={items}
        keyExtractor={(item) => item.id}
        contentContainerStyle={{ padding: theme.spacing.md, gap: theme.spacing.md }}
        refreshing={isRefreshing}
        onRefresh={handleRefresh}
        ListHeaderComponent={
          permissions.canWrite ? (
            <View className="flex-row justify-end" style={{ marginBottom: theme.spacing.sm }}>
              <Pressable testID="goals-add" onPress={() => openModal('AddGoal')}>
                <Plus size={20} color={theme.colors.primary} />
              </Pressable>
            </View>
          ) : null
        }
        renderItem={({ item }) => (
          <ListItemEnter>
            <GoalCard
              goal={item}
              onPress={() => navigation.getParent()?.navigate('GoalDetail', { goalId: item.id })}
            />
          </ListItemEnter>
        )}
      />
    );
  };

  return (
    <AnimatedScreen>
      <WalletContextBar onManage={onManage}>
        <View
          style={{
            paddingHorizontal: theme.spacing.md,
            paddingVertical: theme.spacing.sm,
            backgroundColor: theme.colors.background,
          }}
        >
          <View
            className="flex-row p-[3px] border"
            style={{
              backgroundColor: theme.colors.surfaceMuted,
              borderRadius: theme.radius.md,
              borderColor: theme.colors.border,
            }}
          >
            <Pressable
              testID="planning-segment-budgets"
              onPress={() => setSection('budgets')}
              accessibilityRole="tab"
              accessibilityState={{ selected: section === 'budgets' }}
              className="flex-1 py-sm items-center justify-center"
              style={{
                borderRadius: theme.radius.sm,
                backgroundColor: section === 'budgets' ? theme.colors.surface : 'transparent',
                shadowColor: '#000',
                shadowOffset: { width: 0, height: 1 },
                shadowOpacity: section === 'budgets' ? 0.08 : 0,
                shadowRadius: 2,
                elevation: section === 'budgets' ? 1 : 0,
              }}
            >
              <Text
                weight={section === 'budgets' ? 'bold' : 'medium'}
                tone={section === 'budgets' ? undefined : 'muted'}
                style={{ fontSize: 13 }}
              >
                {t('planning.budgets', 'Budgets')}
              </Text>
            </Pressable>

            <Pressable
              testID="planning-segment-goals"
              onPress={() => setSection('goals')}
              accessibilityRole="tab"
              accessibilityState={{ selected: section === 'goals' }}
              className="flex-1 py-sm items-center justify-center"
              style={{
                borderRadius: theme.radius.sm,
                backgroundColor: section === 'goals' ? theme.colors.surface : 'transparent',
                shadowColor: '#000',
                shadowOffset: { width: 0, height: 1 },
                shadowOpacity: section === 'goals' ? 0.08 : 0,
                shadowRadius: 2,
                elevation: section === 'goals' ? 1 : 0,
              }}
            >
              <Text
                weight={section === 'goals' ? 'bold' : 'medium'}
                tone={section === 'goals' ? undefined : 'muted'}
                style={{ fontSize: 13 }}
              >
                {t('planning.goals', 'Goals')}
              </Text>
            </Pressable>
          </View>
        </View>

        {section === 'budgets' ? renderBudgetsContent() : renderGoalsContent()}
      </WalletContextBar>
    </AnimatedScreen>
  );
}

function BudgetCard({ budget, onPress }: { budget: BudgetResponse; onPress: () => void }) {
  const theme = useTheme();
  const { t } = useTranslation();
  const syncStatus = useSelector(selectQueueEntryFor('budget', budget.id))?.status;

  return (
    <Card testID={`budget-card-${budget.id}`} onTouchEnd={onPress}>
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
  );
}

function GoalCard({ goal, onPress }: { goal: GoalResponse; onPress: () => void }) {
  const theme = useTheme();
  const { t } = useTranslation();
  const syncStatus = useSelector(selectQueueEntryFor('goal', goal.id))?.status;

  return (
    <Card testID={`goal-card-${goal.id}`} onTouchEnd={onPress}>
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

