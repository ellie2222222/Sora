import { PiggyBank } from 'lucide-react-native';
import { FlatList, View } from 'react-native';
import type { BudgetResponse } from '@sora/contracts';

import { Card, EmptyState, ErrorState, Money, ProgressBar, Text } from '../../../components/index.ts';
import { SkeletonList } from '../../../components/Skeleton.tsx';
import { useTheme } from '../../../app/providers/ThemeProvider.tsx';
import { useWallets } from '../../../app/providers/WalletProvider.tsx';
import { WalletContextBar } from '../../wallets/components/WalletContextBar.tsx';
import { today } from '../../../utils/date.ts';
import { formatMoneyString } from '../../../utils/money.ts';
import { useBudgets } from '../hooks/useBudgets.ts';
import type { MainTabScreenProps } from '../../../app/navigation/types.ts';

export function BudgetsScreen({ navigation }: MainTabScreenProps<'Budgets'>) {
  const theme = useTheme();
  const { activeWalletId, permissions } = useWallets();
  const onManage = () => navigation.getParent()?.navigate('WalletList');

  const budgets = useBudgets({ walletId: activeWalletId ?? '', status: 'ACTIVE', activeOn: today() });

  if (activeWalletId === null || budgets.isLoading) {
    return (
      <WalletContextBar onManage={onManage}>
        <SkeletonList rows={4} rowHeight={96} />
      </WalletContextBar>
    );
  }
  if (budgets.isError) {
    return (
      <WalletContextBar onManage={onManage}>
        <ErrorState error={budgets.error} onRetry={() => void budgets.refetch()} testID="budgets-error" />
      </WalletContextBar>
    );
  }

  const items = budgets.data ?? [];

  if (items.length === 0) {
    return (
      <WalletContextBar onManage={onManage}>
        <EmptyState
          icon={PiggyBank}
          title="No active budgets"
          description="Plan how much you want to spend in a category this period."
          actionLabel={permissions.canWrite ? 'Add budget' : undefined}
          onAction={permissions.canWrite ? () => navigation.getParent()?.navigate('AddBudget') : undefined}
          testID="budgets-empty"
        />
      </WalletContextBar>
    );
  }

  return (
    <WalletContextBar onManage={onManage}>
      <FlatList
        testID="budgets-list"
        data={items}
        keyExtractor={(item) => item.id}
        contentContainerStyle={{ padding: theme.spacing.md, gap: theme.spacing.md }}
        renderItem={({ item }) => <BudgetCard budget={item} onPress={() => navigation.getParent()?.navigate('BudgetDetail', { budgetId: item.id })} />}
      />
    </WalletContextBar>
  );
}

function BudgetCard({ budget, onPress }: { budget: BudgetResponse; onPress: () => void }) {
  const theme = useTheme();

  return (
    <Card testID={`budget-card-${budget.id}`} onTouchEnd={onPress}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: theme.spacing.xs }}>
        <Text weight="semibold">{budget.name}</Text>
        {budget.isOverBudget ? (
          <Text variant="caption" tone="danger">
            Over budget
          </Text>
        ) : null}
      </View>

      <ProgressBar percentage={budget.usagePercentage} danger={budget.isOverBudget} />

      <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: theme.spacing.sm }}>
        <View style={{ flexDirection: 'row', gap: theme.spacing.xs }}>
          <Money amount={budget.spent} currency={budget.currency} variant="caption" />
          <Text variant="caption" tone="muted">
            of
          </Text>
          <Money amount={budget.amount} currency={budget.currency} variant="caption" />
        </View>
        <Text variant="caption" tone={budget.isOverBudget ? 'danger' : 'muted'} weight="semibold">
          {formatMoneyString(budget.remaining, budget.currency, { signDisplay: 'always' })} left
        </Text>
      </View>
    </Card>
  );
}
