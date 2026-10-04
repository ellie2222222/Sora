import { useState } from 'react';
import { Archive, Ban, Pencil, PiggyBank, Plus, Target } from 'lucide-react-native';
import { Platform, Pressable, View } from 'react-native';
import { useSelector } from 'react-redux';
import { useTranslation } from 'react-i18next';
import { BudgetStatus, GoalStatus, type BudgetResponse, type GoalResponse } from '@sora/contracts';

import {
  AnimatedScreen,
  Card,
  closeOpenSwipeRow,
  ListItemEnter,
  Money,
  ProgressBar,
  RefreshableFlatList,
  Skeleton,
  SlideSwap,
  StateView,
  SwipeableRow,
  SyncStatusDot,
  Text,
  type SwipeRowAction,
} from '@/components';
import { useModal, useTheme, useToast, useWallets } from '@/app/providers';
import { NoWalletState, WalletContextBar } from '@/features/wallets';
import { ArchiveBudgetDialog, BudgetDetailModal } from '@/features/budgets';
import { CancelGoalDialog, GoalDetailModal } from '@/features/goals';
import { today, formatMoneyString, isNetworkError } from '@/utils';
import { selectQueueEntryFor, useListBudgetsQuery, useListGoalsQuery } from '@/app/store';

type PlanningSection = 'budgets' | 'goals';

export function PlanningScreen() {
  const theme = useTheme();
  const { t } = useTranslation();
  const { activeWalletId, permissions } = useWallets();
  const { openModal } = useModal();
  const { showToast } = useToast();
  const [section, setSection] = useState<PlanningSection>('budgets');
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [selectedBudgetId, setSelectedBudgetId] = useState<string | null>(null);
  const [selectedGoalId, setSelectedGoalId] = useState<string | null>(null);
  const [archivingBudgetId, setArchivingBudgetId] = useState<string | null>(null);
  const [cancellingGoalId, setCancellingGoalId] = useState<string | null>(null);

  // Editing lives in each detail sheet, so Edit opens it; the list shows ACTIVE rows only, all editable.
  const budgetActions = (budget: BudgetResponse): SwipeRowAction[] =>
    permissions.canWrite
      ? [
          { key: 'edit', label: t('common.edit'), icon: Pencil, tone: 'primary', onPress: () => setSelectedBudgetId(budget.id), testID: 'btn-edit-budget' },
          { key: 'archive', label: t('common.archive'), icon: Archive, tone: 'danger', onPress: () => setArchivingBudgetId(budget.id), testID: 'btn-archive-budget' },
        ]
      : [];
  const goalActions = (goal: GoalResponse): SwipeRowAction[] =>
    permissions.canWrite
      ? [
          { key: 'edit', label: t('common.edit'), icon: Pencil, tone: 'primary', onPress: () => setSelectedGoalId(goal.id), testID: 'btn-edit-goal' },
          // Not btn-cancel-goal: that id is the add-goal sheet's Cancel (NC-04).
          { key: 'cancelGoal', label: t('goals.cancelGoalShort'), icon: Ban, tone: 'danger', onPress: () => setCancellingGoalId(goal.id), testID: 'btn-cancel-goal-status' },
        ]
      : [];

  const budgets = useListBudgetsQuery(
    { walletId: activeWalletId ?? '', status: BudgetStatus.ACTIVE, activeOn: today() },
    { skip: activeWalletId === null },
  );

  const goals = useListGoalsQuery(
    { walletId: activeWalletId ?? '', status: GoalStatus.ACTIVE },
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
    // The query is skipped without a wallet, so this must resolve before the
    // loading branch — otherwise the skeleton below never ends.
    if (activeWalletId === null) return <NoWalletState testID="planning-no-wallet" entrance="none" />;
    if (budgets.isLoading) {
      return (
                <View style={{ padding: theme.spacing.md, gap: theme.spacing.md }}>
          {permissions.canWrite ? (
            <View className="flex-row justify-end" style={{ marginBottom: theme.spacing.sm }}>
              <Skeleton width={20} height={20} radius={10} />
            </View>
          ) : null}
          {[1, 2, 3].map((key) => (
            <BudgetItemSkeleton key={key} />
          ))}
        </View>
      );
    }
    if (budgets.isError && !isNetworkError(budgets.error)) {
      return (
        <StateView
          variant="error"
          error={budgets.error}
          retryAction={() => void budgets.refetch()}
          testID="budgets-error"
          entrance="none"
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
          entrance="none"
        />
      );
    }

    return (
      <RefreshableFlatList
        testID="list-budgets"
        data={items}
        keyExtractor={(item) => item.id}
        contentContainerStyle={{ padding: theme.spacing.md, gap: theme.spacing.md }}
        refreshing={isRefreshing}
        onRefresh={handleRefresh}
        ListHeaderComponent={
          permissions.canWrite ? (
            <View className="flex-row justify-end" style={{ marginBottom: theme.spacing.sm }}>
              <Pressable testID="btn-add-budget" hitSlop={12} onPress={() => openModal('AddBudget')}>
                <Plus size={20} color={theme.colors.primary} />
              </Pressable>
            </View>
          ) : null
        }
        onScrollBeginDrag={closeOpenSwipeRow}
        renderItem={({ item }) => (
          <SwipeableRow actions={budgetActions(item)} radius={theme.radius.lg} onActivate={() => setSelectedBudgetId(item.id)}>
            <BudgetCard budget={item} onPress={() => setSelectedBudgetId(item.id)} />
          </SwipeableRow>
        )}
      />
    );
  };

  const renderGoalsContent = () => {
    if (activeWalletId === null) return <NoWalletState testID="planning-no-wallet" entrance="none" />;
    if (goals.isLoading) {
      return (
                <View style={{ padding: theme.spacing.md, gap: theme.spacing.md }}>
          {permissions.canWrite ? (
            <View className="flex-row justify-end" style={{ marginBottom: theme.spacing.sm }}>
              <Skeleton width={20} height={20} radius={10} />
            </View>
          ) : null}
          {[1, 2, 3].map((key) => (
            <GoalItemSkeleton key={key} />
          ))}
        </View>
      );
    }
    if (goals.isError && !isNetworkError(goals.error)) {
      return (
        <StateView
          variant="error"
          error={goals.error}
          retryAction={() => void goals.refetch()}
          testID="goals-error"
          entrance="none"
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
          entrance="none"
        />
      );
    }

    return (
      <RefreshableFlatList
        testID="list-goals"
        data={items}
        keyExtractor={(item) => item.id}
        contentContainerStyle={{ padding: theme.spacing.md, gap: theme.spacing.md }}
        refreshing={isRefreshing}
        onRefresh={handleRefresh}
        ListHeaderComponent={
          permissions.canWrite ? (
            <View className="flex-row justify-end" style={{ marginBottom: theme.spacing.sm }}>
              <Pressable testID="btn-add-goal" hitSlop={12} onPress={() => openModal('AddGoal')}>
                <Plus size={20} color={theme.colors.primary} />
              </Pressable>
            </View>
          ) : null
        }
        onScrollBeginDrag={closeOpenSwipeRow}
        renderItem={({ item }) => (
          <ListItemEnter>
            <SwipeableRow actions={goalActions(item)} radius={theme.radius.lg} onActivate={() => setSelectedGoalId(item.id)}>
              <GoalCard goal={item} onPress={() => setSelectedGoalId(item.id)} />
            </SwipeableRow>
          </ListItemEnter>
        )}
      />
    );
  };

  return (
    <AnimatedScreen testID="screen-planning">
      <WalletContextBar>
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
              style={[
                {
                  borderRadius: theme.radius.sm,
                  backgroundColor: section === 'budgets' ? theme.colors.surface : 'transparent',
                },
                section === 'budgets'
                  ? Platform.select({
                      web: { boxShadow: '0px 1px 2px rgba(0,0,0,0.08)' },
                      default: {
                        shadowColor: '#000',
                        shadowOffset: { width: 0, height: 1 },
                        shadowOpacity: 0.08,
                        shadowRadius: 2,
                        elevation: 1,
                      },
                    })
                  : undefined,
              ]}
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
              style={[
                {
                  borderRadius: theme.radius.sm,
                  backgroundColor: section === 'goals' ? theme.colors.surface : 'transparent',
                },
                section === 'goals'
                  ? Platform.select({
                      web: { boxShadow: '0px 1px 2px rgba(0,0,0,0.08)' },
                      default: {
                        shadowColor: '#000',
                        shadowOffset: { width: 0, height: 1 },
                        shadowOpacity: 0.08,
                        shadowRadius: 2,
                        elevation: 1,
                      },
                    })
                  : undefined,
              ]}
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

        <SlideSwap swapKey={section === 'budgets' ? 0 : 1} style={{ flex: 1 }}>
          {section === 'budgets' ? renderBudgetsContent() : renderGoalsContent()}
        </SlideSwap>
      </WalletContextBar>
      <BudgetDetailModal budgetId={selectedBudgetId} onClose={() => setSelectedBudgetId(null)} />
      <GoalDetailModal goalId={selectedGoalId} onClose={() => setSelectedGoalId(null)} />
      <ArchiveBudgetDialog
        budgetId={archivingBudgetId}
        onCancel={() => setArchivingBudgetId(null)}
        onArchived={() => setArchivingBudgetId(null)}
        onError={(message) => {
          setArchivingBudgetId(null);
          showToast(message, 'error');
        }}
      />
      <CancelGoalDialog
        goalId={cancellingGoalId}
        onCancel={() => setCancellingGoalId(null)}
        onCancelled={() => setCancellingGoalId(null)}
        onError={(message) => {
          setCancellingGoalId(null);
          showToast(message, 'error');
        }}
      />
    </AnimatedScreen>
  );
}

function BudgetCard({ budget, onPress }: { budget: BudgetResponse; onPress: () => void }) {
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

function GoalCard({ goal, onPress }: { goal: GoalResponse; onPress: () => void }) {
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
    </Pressable>
  );
}

function BudgetItemSkeleton() {
  const theme = useTheme();

  return (
    <Card>
      <View className="flex-row items-center justify-between" style={{ marginBottom: theme.spacing.xs }}>
        <Skeleton width={120} height={20} radius={theme.radius.sm} />
      </View>

      <Skeleton width="100%" height={8} radius={theme.radius.sm} />

      <View className="flex-row justify-between" style={{ marginTop: theme.spacing.sm }}>
        <Skeleton width={80} height={16} radius={theme.radius.sm} />
        <Skeleton width={60} height={16} radius={theme.radius.sm} />
      </View>
    </Card>
  );
}

function GoalItemSkeleton() {
  const theme = useTheme();

  return (
    <Card>
      <View className="flex-row items-center" style={{ gap: theme.spacing.xs, marginBottom: theme.spacing.xs }}>
        <Skeleton width={100} height={20} radius={theme.radius.sm} />
      </View>

      <View className="flex-row" style={{ gap: theme.spacing.xs, marginBottom: theme.spacing.sm }}>
        <Skeleton width={150} height={28} radius={theme.radius.sm} />
      </View>

      <Skeleton width="100%" height={8} radius={theme.radius.sm} />

      <View className="flex-row justify-between" style={{ marginTop: theme.spacing.sm }}>
        <Skeleton width={40} height={16} radius={theme.radius.sm} />
        <Skeleton width={80} height={16} radius={theme.radius.sm} />
      </View>
    </Card>
  );
}
