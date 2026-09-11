import { Landmark, Plus, Wallet as WalletIcon } from 'lucide-react-native';
import { Pressable, RefreshControl, ScrollView, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { add, formatMoney, isNegative, negate, parseMoney, ZERO, type AccountResponse } from '@sora/contracts';

import { Card, EmptyState, ErrorState, Money, Text } from '../../../components/index.ts';
import { SkeletonList } from '../../../components/Skeleton.tsx';
import { useTheme } from '../../../app/providers/ThemeProvider.tsx';
import { useWallets } from '../../../app/providers/WalletProvider.tsx';
import { useListAccountsQuery } from '../../../app/store/api/accountsApi.ts';
import { WalletContextBar } from '../../wallets/components/WalletContextBar.tsx';
import { sumScaledByKey } from '../../../utils/money.ts';
import { ACCOUNT_ICON } from '../components/AccountPicker.tsx';
import type { MainTabScreenProps } from '../../../app/navigation/types.ts';

export function AccountsScreen({ navigation }: MainTabScreenProps<'Account'>) {
  const theme = useTheme();
  const { t } = useTranslation();
  const { activeWalletId, isLoading: walletsLoading, isError: walletsError, refetch: refetchWallets, permissions } = useWallets();
  const onManage = () => navigation.getParent()?.navigate('WalletList');

  const accounts = useListAccountsQuery(
    { walletId: activeWalletId ?? undefined, status: 'ACTIVE' },
    { skip: activeWalletId === null },
  );

  if (walletsLoading) return <SkeletonList rows={5} />;
  if (walletsError) return <ErrorState error={new Error('Could not load your wallets')} onRetry={refetchWallets} />;

  if (activeWalletId === null) {
    return (
      <EmptyState
        icon={WalletIcon}
        title={t('home.noWalletTitle')}
        description={t('home.noWalletDescription')}
        testID="accounts-no-wallet"
      />
    );
  }

  if (accounts.isLoading) {
    return (
      <WalletContextBar onManage={onManage}>
        <SkeletonList rows={5} />
      </WalletContextBar>
    );
  }
  if (accounts.isError) {
    return (
      <WalletContextBar onManage={onManage}>
        <ErrorState error={accounts.error} onRetry={() => void accounts.refetch()} testID="accounts-error" />
      </WalletContextBar>
    );
  }

  const items = accounts.data ?? [];
  const { assets, liabilities, netWorth } = netWorthByCurrency(items);

  return (
    <WalletContextBar onManage={onManage}>
      <ScrollView
        testID="accounts-screen"
        contentContainerStyle={{ padding: theme.spacing.md, gap: theme.spacing.lg }}
        refreshControl={<RefreshControl refreshing={accounts.isFetching} onRefresh={() => void accounts.refetch()} />}
      >
        <View>
          <Text variant="label" tone="muted">
            Net worth
          </Text>
          {netWorth.length === 0 ? (
            <Text tone="faint">—</Text>
          ) : (
            netWorth.map((total) => <Money key={total.currency} amount={total.amount} currency={total.currency} variant="heading" />)
          )}
          <View style={{ flexDirection: 'row', gap: theme.spacing.md, marginTop: theme.spacing.sm }}>
            <View style={{ flex: 1 }}>
              <Text variant="caption" tone="muted">
                Assets
              </Text>
              {assets.map((total) => (
                <Money key={total.currency} amount={total.amount} currency={total.currency} variant="body" />
              ))}
              {assets.length === 0 ? <Text tone="faint">—</Text> : null}
            </View>
            <View style={{ flex: 1 }}>
              <Text variant="caption" tone="muted">
                Liabilities
              </Text>
              {liabilities.length === 0 ? (
                <Text tone="faint">—</Text>
              ) : (
                liabilities.map((total) => <Money key={total.currency} amount={total.amount} currency={total.currency} variant="body" />)
              )}
            </View>
          </View>
        </View>

        <View>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: theme.spacing.xs }}>
            <Text variant="label" tone="muted">
              Accounts
            </Text>
            {permissions.canWrite ? (
              <Pressable
                testID="accounts-add"
                onPress={() => navigation.getParent()?.navigate('AddAccount', { walletId: activeWalletId ?? undefined })}
              >
                <Plus size={20} color={theme.colors.primary} />
              </Pressable>
            ) : null}
          </View>

          {items.length === 0 ? (
            <EmptyState
              icon={Landmark}
              title="No accounts yet"
              description="Add a bank account, cash, or an e-wallet."
              actionLabel={permissions.canWrite ? 'Add account' : undefined}
              onAction={
                permissions.canWrite
                  ? () => navigation.getParent()?.navigate('AddAccount', { walletId: activeWalletId ?? undefined })
                  : undefined
              }
              testID="accounts-empty"
            />
          ) : (
            <View style={{ borderTopWidth: 1, borderTopColor: theme.colors.border }}>
              {items.map((account, index) => (
                <View key={account.id} style={index === 0 ? undefined : { borderTopWidth: 1, borderTopColor: theme.colors.border }}>
                  <AccountRow
                    account={account}
                    onPress={() => navigation.getParent()?.navigate('AccountDetail', { accountId: account.id })}
                  />
                </View>
              ))}
            </View>
          )}
        </View>
      </ScrollView>
    </WalletContextBar>
  );
}

function AccountRow({ account, onPress }: { account: AccountResponse; onPress: () => void }) {
  const theme = useTheme();
  const Icon = ACCOUNT_ICON[account.type];

  return (
    <Pressable
      testID={`account-row-${account.id}`}
      onPress={onPress}
      style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: theme.spacing.sm }}
    >
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: theme.spacing.sm }}>
        <Icon size={18} color={theme.colors.textMuted} />
        <Text>{account.name}</Text>
      </View>
      <Money amount={account.balance} currency={account.currency} weight="semibold" />
    </Pressable>
  );
}

/**
 * Assets/liabilities/net-worth per currency, never summed across currencies
 * (BR-07). A credit card's negative `balance` is the one signed amount in
 * the domain (VL-04) and is what makes an account a liability here.
 */
function netWorthByCurrency(accounts: AccountResponse[]) {
  const isAsset = (account: AccountResponse) => !isNegative(parseMoney(account.balance));
  const assetsByCurrency = sumScaledByKey(accounts.filter(isAsset), (a) => a.currency, (a) => a.balance);
  const liabilitiesByCurrency = sumScaledByKey(
    accounts.filter((account) => !isAsset(account)),
    (a) => a.currency,
    (a) => a.balance,
  );

  const currencies = new Set([...assetsByCurrency.keys(), ...liabilitiesByCurrency.keys()]);

  const assets = Array.from(assetsByCurrency.entries()).map(([currency, amount]) => ({ currency, amount: formatMoney(amount) }));
  const liabilities = Array.from(liabilitiesByCurrency.entries()).map(([currency, amount]) => ({
    currency,
    amount: formatMoney(negate(amount)),
  }));
  const netWorth = Array.from(currencies).map((currency) => {
    const assetAmount = assetsByCurrency.get(currency) ?? ZERO;
    const liabilityAmount = liabilitiesByCurrency.get(currency) ?? ZERO;
    return { currency, amount: formatMoney(add(assetAmount, liabilityAmount)) };
  });

  return { assets, liabilities, netWorth };
}
