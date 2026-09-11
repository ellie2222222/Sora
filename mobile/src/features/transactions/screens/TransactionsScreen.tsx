import { Receipt } from 'lucide-react-native';
import { RefreshControl, ScrollView } from 'react-native';

import { EmptyState, ErrorState, TransactionListSection } from '../../../components/index.ts';
import { SkeletonList } from '../../../components/Skeleton.tsx';
import { useAuth } from '../../../app/providers/AuthProvider.tsx';
import { useTheme } from '../../../app/providers/ThemeProvider.tsx';
import { useWallets } from '../../../app/providers/WalletProvider.tsx';
import { useListTransactionsQuery } from '../../../app/store/api/transactionsApi.ts';
import { WalletContextBar } from '../../wallets/components/WalletContextBar.tsx';
import { groupTransactionsByDay } from '../../../utils/groupByDate.ts';
import type { AppStackScreenProps } from '../../../app/navigation/types.ts';

export function TransactionsScreen({ route, navigation }: AppStackScreenProps<'Transactions'>) {
  const theme = useTheme();
  const { isGuest } = useAuth();
  const { activeWalletId } = useWallets();
  const onManage = () => navigation.navigate('WalletList');

  const walletId = activeWalletId ?? undefined;
  const accountId = route.params?.accountId;
  const transactions = useListTransactionsQuery(
    { walletId, accountId, categoryId: route.params?.categoryId, pageSize: 100 },
    // Guest mode has one wallet and never receives a walletId filter from the
    // wallet switcher, so gating on one would leave the list permanently idle.
    { skip: !isGuest && walletId === undefined && accountId === undefined },
  );

  if (transactions.isLoading) {
    return (
      <WalletContextBar onManage={onManage}>
        <SkeletonList rows={8} />
      </WalletContextBar>
    );
  }
  if (transactions.isError) {
    return (
      <WalletContextBar onManage={onManage}>
        <ErrorState error={transactions.error} onRetry={() => void transactions.refetch()} testID="transactions-error" />
      </WalletContextBar>
    );
  }

  const items = transactions.data?.items ?? [];

  if (items.length === 0) {
    return (
      <WalletContextBar onManage={onManage}>
        <EmptyState
          icon={Receipt}
          title="No transactions yet"
          description="Record your first expense, income or transfer."
          actionLabel="Add transaction"
          onAction={() => navigation.navigate('AddTransaction')}
          testID="transactions-empty"
        />
      </WalletContextBar>
    );
  }

  const groups = groupTransactionsByDay(items);

  return (
    <WalletContextBar onManage={onManage}>
      <ScrollView
        testID="transactions-list"
        contentContainerStyle={{ padding: theme.spacing.md, paddingBottom: theme.spacing.xxl }}
        refreshControl={<RefreshControl refreshing={transactions.isFetching} onRefresh={() => void transactions.refetch()} />}
      >
        <TransactionListSection groups={groups} showDayTotals />
      </ScrollView>
    </WalletContextBar>
  );
}
