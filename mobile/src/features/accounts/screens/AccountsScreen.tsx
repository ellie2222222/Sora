import { Landmark, Plus, Wallet as WalletIcon } from 'lucide-react-native';
import { Pressable, RefreshControl, ScrollView, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { add, formatMoney, isNegative, negate, parseMoney, ZERO, type AccountResponse } from '@sora/contracts';

import { AnimatedScreen, Card, ListItemEnter, Money, StateView, Text } from '../../../components';
import { SkeletonList } from '../../../components/Skeleton';
import { useModal } from '../../../app/providers/ModalProvider';
import { useTheme } from '../../../app/providers/ThemeProvider';
import { useWallets } from '../../../app/providers/WalletProvider';
import { useListAccountsQuery } from '../../../app/store/api/accountsApi';
import { WalletContextBar } from '../../wallets/components/WalletContextBar';
import { sumScaledByKey } from '../../../utils/money';
import { ACCOUNT_ICON } from '../components/AccountPicker';
import type { MainTabScreenProps } from '../../../app/navigation/types';

export function AccountsScreen({ navigation }: MainTabScreenProps<'Account'>) {
  const theme = useTheme();
  const { t } = useTranslation();
  const { openModal } = useModal();
  const { activeWalletId, isLoading: walletsLoading, isError: walletsError, refetch: refetchWallets, permissions } = useWallets();
  const onManage = () => navigation.getParent()?.navigate('WalletList');

  const accounts = useListAccountsQuery(
    { walletId: activeWalletId ?? undefined, status: 'ACTIVE' },
    { skip: activeWalletId === null },
  );

  // Determine what to render in the content area
  const renderContent = () => {
    if (walletsLoading) return <SkeletonList rows={5} />;
    if (walletsError) {
      return <StateView variant="error" error={new Error(t('errors.loadWalletsFailed'))} retryAction={refetchWallets} />;
    }

    if (activeWalletId === null) {
      return (
        <StateView
          variant="empty"
          icon={WalletIcon}
          title={t('home.noWalletTitle')}
          message={t('home.noWalletDescription')}
          testID="accounts-no-wallet"
        />
      );
    }

    if (accounts.isLoading) return <SkeletonList rows={5} />;
    if (accounts.isError) {
      return <StateView variant="error" error={accounts.error} retryAction={() => void accounts.refetch()} testID="accounts-error" />;
    }

    const items = accounts.data ?? [];
    const { assets, liabilities, netWorth } = netWorthByCurrency(items);

    return (
      <ScrollView
        testID="accounts-screen"
        contentContainerStyle={{ padding: theme.spacing.md, gap: theme.spacing.lg }}
        refreshControl={<RefreshControl refreshing={accounts.isFetching} onRefresh={() => void accounts.refetch()} />}
      >
        <View>
          <Text variant="label" tone="muted">
            {t('accounts.netWorth')}
          </Text>
          {netWorth.length === 0 ? (
            <Text tone="faint">—</Text>
          ) : (
            netWorth.map((total) => <Money key={total.currency} amount={total.amount} currency={total.currency} variant="heading" />)
          )}
          <View style={{ flexDirection: 'row', gap: theme.spacing.md, marginTop: theme.spacing.sm }}>
            <View style={{ flex: 1 }}>
              <Text variant="caption" tone="muted">
                {t('accounts.assets')}
              </Text>
              {assets.map((total) => (
                <Money key={total.currency} amount={total.amount} currency={total.currency} variant="body" />
              ))}
              {assets.length === 0 ? <Text tone="faint">—</Text> : null}
            </View>
            <View style={{ flex: 1 }}>
              <Text variant="caption" tone="muted">
                {t('accounts.liabilities')}
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
              {t('accounts.accountsLabel')}
            </Text>
            {permissions.canWrite ? (
              <Pressable
                testID="accounts-add"
                onPress={() => openModal('AddAccount', { walletId: activeWalletId ?? undefined })}
              >
                <Plus size={20} color={theme.colors.primary} />
              </Pressable>
            ) : null}
          </View>

          {items.length === 0 ? (
            <StateView
              variant="empty"
              icon={Landmark}
              title={t('accounts.noAccountsTitle')}
              message={t('accounts.noAccountsMessage')}
              primaryAction={
                permissions.canWrite
                  ? {
                      label: t('accounts.addAccount'),
                      onPress: () => openModal('AddAccount', { walletId: activeWalletId ?? undefined }),
                      icon: Plus,
                    }
                  : undefined
              }
              testID="accounts-empty"
            />
          ) : (
            <View style={{ borderTopWidth: 1, borderTopColor: theme.colors.border }}>
              {items.map((account, index) => (
                <View key={account.id} style={index === 0 ? undefined : { borderTopWidth: 1, borderTopColor: theme.colors.border }}>
                  <ListItemEnter>
                    <AccountRow
                      account={account}
                      onPress={() => navigation.getParent()?.navigate('AccountDetail', { accountId: account.id })}
                    />
                  </ListItemEnter>
                </View>
              ))}
            </View>
          )}
        </View>
      </ScrollView>
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
