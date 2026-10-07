import { useState } from 'react';
import { Ban, Pencil, PiggyBank, Plus, Target, Trash2 } from 'lucide-react-native';
import { View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { GoalStatus, type BudgetResponse, type GoalResponse } from '@sora/contracts';

import {
  AnimatedScreen,
  closeOpenSwipeRow,
  Fab,
  fabListPaddingBottom,
  ListItemEnter,
  RefreshableFlatList,
  SegmentedControl,
  SlideSwap,
  StateView,
  SwipeableRow,
  type SwipeRowAction,
} from '@/components';
import { useModal, useTheme, useToast, useWallets } from '@/app/providers';
import { NoWalletState, WalletContextBar } from '@/features/wallets';
import { BudgetDetailModal, DeleteBudgetDialog } from '@/features/budgets';
import { CancelGoalDialog, GoalDetailModal } from '@/features/goals';
import { today, isNetworkError } from '@/utils';
import { useListBudgetsQuery, useListGoalsQuery } from '@/app/store';
import { BudgetCard, BudgetItemSkeleton } from '../components/BudgetCard.tsx';
import { GoalCard, GoalItemSkeleton } from '../components/GoalCard.tsx';

type PlanningSection = 'budgets' | 'goals';

export function PlanningScreen() {
  const theme = useTheme();
  const { t } = useTranslation();
  const { activeWalletId, permissions, timeZone } = useWallets();
  const { openModal } = useModal();
  const { showToast } = useToast();
  const [section, setSection] = useState<PlanningSection>('budgets');
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [selectedBudgetId, setSelectedBudgetId] = useState<string | null>(null);
  const [selectedGoalId, setSelectedGoalId] = useState<string | null>(null);
  const [deletingBudgetId, setDeletingBudgetId] = useState<string | null>(null);
  const [cancellingGoalId, setCancellingGoalId] = useState<string | null>(null);

  // Editing lives in each detail sheet, so Edit opens it; the list shows the budgets covering today, all editable.
  const budgetActions = (budget: BudgetResponse): SwipeRowAction[] =>
    permissions.canWrite
      ? [
          { key: 'edit', label: t('common.edit'), icon: Pencil, tone: 'primary', onPress: () => setSelectedBudgetId(budget.id), testID: 'btn-edit-budget' },
          { key: 'delete', label: t('common.delete'), icon: Trash2, tone: 'danger', onPress: () => setDeletingBudgetId(budget.id), testID: 'btn-delete-budget' },
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
    { walletId: activeWalletId ?? '', activeOn: today(timeZone) },
    { skip: activeWalletId === null },
  );

  const goals = useListGoalsQuery(
    { walletId: activeWalletId ?? '', status: GoalStatus.ACTIVE },
    { skip: activeWalletId === null },
  );

  // Like the transaction list: the empty state carries its own create action, so the Fab joins only once rows exist.
  const activeList = section === 'budgets' ? budgets : goals;
  const showFab = permissions.canWrite && activeWalletId !== null && !activeList.isLoading && (activeList.data?.length ?? 0) > 0;
  const listContentStyle = { padding: theme.spacing.md, paddingBottom: fabListPaddingBottom(theme), gap: theme.spacing.md };

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
        contentContainerStyle={listContentStyle}
        refreshing={isRefreshing}
        onRefresh={handleRefresh}
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
        contentContainerStyle={listContentStyle}
        refreshing={isRefreshing}
        onRefresh={handleRefresh}
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
          <SegmentedControl
            options={[
              { value: 'budgets', label: t('planning.budgets', 'Budgets'), testID: 'planning-segment-budgets' },
              { value: 'goals', label: t('planning.goals', 'Goals'), testID: 'planning-segment-goals' },
            ]}
            value={section}
            onChange={setSection}
          />
        </View>

        <SlideSwap swapKey={section === 'budgets' ? 0 : 1} style={{ flex: 1 }}>
          {section === 'budgets' ? renderBudgetsContent() : renderGoalsContent()}
        </SlideSwap>

        {showFab ? (
          <Fab
            testID={section === 'budgets' ? 'btn-add-budget' : 'btn-add-goal'}
            label={section === 'budgets' ? t('budgets.newBudget') : t('goals.newGoal')}
            onPress={() => openModal(section === 'budgets' ? 'AddBudget' : 'AddGoal')}
          />
        ) : null}
      </WalletContextBar>
      <BudgetDetailModal budgetId={selectedBudgetId} onClose={() => setSelectedBudgetId(null)} />
      <GoalDetailModal goalId={selectedGoalId} onClose={() => setSelectedGoalId(null)} />
      <DeleteBudgetDialog
        budgetId={deletingBudgetId}
        onCancel={() => setDeletingBudgetId(null)}
        onDeleted={() => setDeletingBudgetId(null)}
        onError={(message) => {
          setDeletingBudgetId(null);
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
