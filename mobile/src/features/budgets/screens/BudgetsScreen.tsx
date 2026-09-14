import { useState } from 'react';
import { PiggyBank, Plus } from 'lucide-react-native';
import { Pressable, View } from 'react-native';
import { useSelector } from 'react-redux';
import { useTranslation } from 'react-i18next';
import type { BudgetResponse } from '@sora/contracts';

import { AnimatedScreen, Card, Money, ProgressBar, RefreshableFlatList, StateView, SyncStatusDot, Text } from '../../../components/index.ts';
import { SkeletonList } from '../../../components/Skeleton.tsx';
import { useModal } from '../../../app/providers/ModalProvider.tsx';
import { useTheme } from '../../../app/providers/ThemeProvider.tsx';
import { useWallets } from '../../../app/providers/WalletProvider.tsx';
import { WalletContextBar } from '../../wallets/components/WalletContextBar.tsx';
import { today } from '../../../utils/date.ts';
import { formatMoneyString } from '../../../utils/money.ts';
import { useListBudgetsQuery } from '../../../app/store/api/budgetsApi.ts';
import { selectQueueEntryFor } from '../../../app/store/offlineQueueSlice.ts';
import type { AppStackScreenProps } from '../../../app/navigation/types.ts';

export function BudgetsScreen({ navigation }: AppStackScreenProps<'Budgets'>) {
  const theme = useTheme();
  const { t } = useTranslation();
  const { activeWalletId, permissions } = useWallets();
  const { openModal } = useModal();
  const [isRefreshing, setIsRefreshing] = useState(false);
  const onManage = () => navigation.navigate('WalletList');

  const budgets = useListBudgetsQuery(
    { walletId: activeWalletId ?? '', status: 'ACTIVE', activeOn: today() },
    { skip: activeWalletId === null },
  );

  const handleRefresh = async () => {
    setIsRefreshing(true);
    try {
      await budgets.refetch();
    } finally {
      setIsRefreshing(false);
    }
  };

  const renderContent = () => {
    if (activeWalletId === null || budgets.isLoading) {
      return <SkeletonList rows={4} rowHeight={96} />;
    }
    if (budgets.isError) {
      return <StateView variant="error" error={budgets.error} retryAction={() => void budgets.refetch()} testID="budgets-error" />;
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
            permissions.canWrite ? { label: t('budgets.newBudget'), onPress: () => openModal('AddBudget'), icon: Plus } : undefined
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
            <View style={{ flexDirection: 'row', justifyContent: 'flex-end', marginBottom: theme.spacing.sm }}>
              <Pressable testID="budgets-add" onPress={() => openModal('AddBudget')}>
                <Plus size={20} color={theme.colors.primary} />
              </Pressable>
            </View>
          ) : null
        }
        renderItem={({ item }) => <BudgetCard budget={item} onPress={() => navigation.navigate('BudgetDetail', { budgetId: item.id })} />}
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

function BudgetCard({ budget, onPress }: { budget: BudgetResponse; onPress: () => void }) {
  const theme = useTheme();
  const { t } = useTranslation();
  const syncStatus = useSelector(selectQueueEntryFor('budget', budget.id))?.status;

  return (
    <Card testID={`budget-card-${budget.id}`} onTouchEnd={onPress}>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: theme.spacing.xs }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: theme.spacing.xs }}>
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

      <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: theme.spacing.sm }}>
        <View style={{ flexDirection: 'row', gap: theme.spacing.xs }}>
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

