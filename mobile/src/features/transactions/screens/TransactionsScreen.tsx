import { Receipt, UsersRound } from 'lucide-react-native';
import { SectionList, View } from 'react-native';

import { EmptyState, ErrorState, Money, Text } from '../../../components/index.ts';
import { SkeletonList } from '../../../components/Skeleton.tsx';
import { useTheme } from '../../../app/providers/ThemeProvider.tsx';
import { useWallets } from '../../../app/providers/WalletProvider.tsx';
import { formatDayHeading, formatTimeOfDay } from '../../../utils/date.ts';
import { groupTransactionsByDay } from '../../../utils/groupByDate.ts';
import { useTransactions } from '../hooks/useTransactions.ts';
import type { MainTabScreenProps } from '../../../app/navigation/types.ts';

export function TransactionsScreen({ route, navigation }: MainTabScreenProps<'Transactions'>) {
  const theme = useTheme();
  const { activeWalletId } = useWallets();

  const transactions = useTransactions({
    walletId: activeWalletId ?? undefined,
    accountId: route.params?.accountId,
    categoryId: route.params?.categoryId,
    pageSize: 100,
  });

  if (transactions.isLoading) return <SkeletonList rows={8} />;
  if (transactions.isError) {
    return <ErrorState error={transactions.error} onRetry={() => void transactions.refetch()} testID="transactions-error" />;
  }

  const items = transactions.data?.items ?? [];

  if (items.length === 0) {
    return (
      <EmptyState
        icon={Receipt}
        title="No transactions yet"
        description="Record your first expense, income or transfer."
        actionLabel="Add transaction"
        onAction={() => navigation.navigate('AddTransaction')}
        testID="transactions-empty"
      />
    );
  }

  const sections = groupTransactionsByDay(items).map((group) => ({
    title: formatDayHeading(group.day),
    data: group.transactions,
  }));

  return (
    <SectionList
      testID="transactions-list"
      sections={sections}
      keyExtractor={(item) => item.id}
      contentContainerStyle={{ paddingBottom: theme.spacing.xxl }}
      renderSectionHeader={({ section }) => (
        <View style={{ backgroundColor: theme.colors.background, padding: theme.spacing.md, paddingBottom: theme.spacing.xs }}>
          <Text variant="label" tone="muted">
            {section.title}
          </Text>
        </View>
      )}
      renderItem={({ item }) => (
        <View
          testID={`transaction-row-${item.id}`}
          style={{
            flexDirection: 'row',
            justifyContent: 'space-between',
            paddingHorizontal: theme.spacing.md,
            paddingVertical: theme.spacing.sm,
          }}
        >
          <View style={{ flex: 1, gap: 2 }}>
            <Text numberOfLines={1}>
              {item.description ?? item.category?.name ?? item.type}
            </Text>
            <View style={{ flexDirection: 'row', gap: theme.spacing.xs, alignItems: 'center' }}>
              <Text variant="caption" tone="muted">
                {formatTimeOfDay(item.transactionDate)}
                {item.category !== null ? ` · ${item.category.name}` : ''}
              </Text>
              {item.isCrossWallet ? <UsersRound size={12} color={theme.colors.textFaint} /> : null}
            </View>
          </View>
          <Money
            amount={item.amount}
            currency={item.currency}
            type={item.type}
            weight="semibold"
            formatOptions={{ signDisplay: 'always' }}
          />
        </View>
      )}
    />
  );
}
