import { ArrowDownLeft, ArrowUpRight, Settings as SettingsIcon, Wallet as WalletIcon } from 'lucide-react-native';
import { Pressable, RefreshControl, ScrollView, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import type { CategorySpendSlice, CurrencyTotal } from '@sora/contracts';

import { Card, EmptyState, ErrorState, Money, Text } from '../../../components/index.ts';
import { SkeletonList } from '../../../components/Skeleton.tsx';
import { useTheme } from '../../../app/providers/ThemeProvider.tsx';
import { useWallets } from '../../../app/providers/WalletProvider.tsx';
import { WalletSwitcher } from '../../wallets/components/WalletSwitcher.tsx';
import { formatDayHeading } from '../../../utils/date.ts';
import { useDashboard } from '../hooks/useDashboard.ts';
import type { MainTabScreenProps } from '../../../app/navigation/types.ts';

export function HomeScreen({ navigation }: MainTabScreenProps<'Home'>) {
  const theme = useTheme();
  const { t } = useTranslation();
  const { activeWalletId, isLoading: walletsLoading, isError: walletsError, refetch: refetchWallets } = useWallets();
  const dashboard = useDashboard(activeWalletId);

  if (walletsLoading) return <SkeletonList rows={5} />;
  if (walletsError) return <ErrorState error={new Error('Could not load your wallets')} onRetry={refetchWallets} />;

  if (activeWalletId === null) {
    return (
      <EmptyState
        icon={WalletIcon}
        title={t('home.noWalletTitle')}
        description={t('home.noWalletDescription')}
        testID="home-empty"
      />
    );
  }

  if (dashboard.isLoading) return <SkeletonList rows={6} />;
  if (dashboard.isError) {
    return <ErrorState error={dashboard.error} onRetry={() => void dashboard.refetch()} testID="home-error" />;
  }

  const data = dashboard.data;
  if (data === undefined) return null;

  return (
    <ScrollView
      testID="home-screen"
      contentContainerStyle={{ padding: theme.spacing.md, gap: theme.spacing.md }}
      refreshControl={<RefreshControl refreshing={dashboard.isFetching} onRefresh={() => void dashboard.refetch()} />}
    >
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          paddingHorizontal: theme.spacing.xs,
          gap: theme.spacing.sm,
        }}
      >
        <View style={{ flex: 1 }}>
          <WalletSwitcher onManage={() => navigation.getParent()?.navigate('WalletList')} />
        </View>
        <Pressable
          testID="home-settings"
          accessibilityRole="button"
          accessibilityLabel={t('settings.title')}
          onPress={() => navigation.getParent()?.navigate('Settings')}
          style={{ padding: theme.spacing.xs }}
        >
          <SettingsIcon size={22} color={theme.colors.textMuted} />
        </Pressable>
      </View>

      <Card elevated>
        <Text variant="label" tone="muted">
          {t('home.totalBalance')}
        </Text>
        <BalanceTotals totals={data.totalBalance} />
      </Card>

      <View style={{ flexDirection: 'row', gap: theme.spacing.md }}>
        <Card style={{ flex: 1 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: theme.spacing.xs }}>
            <ArrowDownLeft size={16} color={theme.colors.income} />
            <Text variant="label" tone="muted">
              {t('home.income')}
            </Text>
          </View>
          <BalanceTotals totals={data.income} variant="body" />
        </Card>
        <Card style={{ flex: 1 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: theme.spacing.xs }}>
            <ArrowUpRight size={16} color={theme.colors.expense} />
            <Text variant="label" tone="muted">
              {t('home.expenses')}
            </Text>
          </View>
          <BalanceTotals totals={data.expense} variant="body" />
        </Card>
      </View>

      {data.spendingByCategory.length > 0 ? (
        <Card>
          <Text variant="label" tone="muted" style={{ marginBottom: theme.spacing.sm }}>
            {t('home.spendingByCategory')}
          </Text>
          {data.spendingByCategory.map((slice) => (
            <SpendingRow key={slice.categoryId} slice={slice} />
          ))}
        </Card>
      ) : null}

      <Card>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: theme.spacing.sm }}>
          <Text variant="label" tone="muted">
            {t('home.recentTransactions')}
          </Text>
          <Text
            variant="label"
            tone="muted"
            onPress={() => navigation.navigate('Transactions')}
            testID="home-view-all-transactions"
          >
            {t('home.viewAll')}
          </Text>
        </View>
        {data.recentTransactions.length === 0 ? (
          <Text tone="faint">{t('home.noTransactionsYet')}</Text>
        ) : (
          data.recentTransactions.map((transaction) => (
            <View
              key={transaction.id}
              style={{
                flexDirection: 'row',
                justifyContent: 'space-between',
                paddingVertical: theme.spacing.xs,
              }}
            >
              <View style={{ flex: 1 }}>
                <Text numberOfLines={1}>{transaction.description ?? transaction.category?.name ?? transaction.type}</Text>
                <Text variant="caption" tone="muted">
                  {formatDayHeading(transaction.transactionDate.slice(0, 10))}
                  {transaction.isCrossWallet ? ` · ${t('home.crossWallet')}` : ''}
                </Text>
              </View>
              <Money
                amount={transaction.amount}
                currency={transaction.currency}
                type={transaction.type}
                formatOptions={{ signDisplay: 'always' }}
              />
            </View>
          ))
        )}
      </Card>
    </ScrollView>
  );
}

function BalanceTotals({ totals, variant = 'heading' }: { totals: CurrencyTotal[]; variant?: 'heading' | 'body' }) {
  if (totals.length === 0) return <Text tone="faint">—</Text>;
  return (
    <>
      {totals.map((total) => (
        <Money key={total.currency} amount={total.amount} currency={total.currency} variant={variant} />
      ))}
    </>
  );
}

function SpendingRow({ slice }: { slice: CategorySpendSlice }) {
  const theme = useTheme();
  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingVertical: theme.spacing.xs,
      }}
    >
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: theme.spacing.sm }}>
        <View
          style={{
            width: 8,
            height: 8,
            borderRadius: 4,
            backgroundColor: slice.color ?? theme.colors.primary,
          }}
        />
        <Text>{slice.categoryName}</Text>
      </View>
      <Text tone="muted">{slice.percentage.toFixed(0)}%</Text>
    </View>
  );
}
