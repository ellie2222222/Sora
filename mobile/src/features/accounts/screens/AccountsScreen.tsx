import { useState } from 'react';
import { Landmark, Plus, Wallet as WalletIcon } from 'lucide-react-native';
import { Pressable, View } from 'react-native';
import { useSelector } from 'react-redux';
import { useTranslation } from 'react-i18next';
import {
  ACCOUNT_TYPES,
  add,
  formatMoney,
  isNegative,
  negate,
  parseMoney,
  ZERO,
  type AccountResponse,
} from '@sora/contracts';
import { AnimatedScreen, ListItemEnter, Money, RefreshableScrollView, SkeletonList, StateView, SyncStatusDot, Text } from '@/components';
import { useModal, useTheme, useWallets } from '@/app/providers';
import { selectQueueEntryFor, useListAccountsQuery } from '@/app/store';
import { WalletContextBar } from '@/features/wallets';
import { isNetworkError, sumScaledByKey } from '@/utils';
import { ACCOUNT_ICON, ACCOUNT_TYPE_LABEL_KEY } from '../components/AccountPicker';
import type { MainTabScreenProps } from '@/app/navigation';

export function AccountsScreen({ navigation }: MainTabScreenProps<'Account'>) {
  const theme = useTheme();
  const { t } = useTranslation();
  const { openModal } = useModal();
  const {
    activeWalletId,
    isLoading: walletsLoading,
    isError: walletsError,
    refetch: refetchWallets,
    permissions,
  } = useWallets();
  const [isRefreshing, setIsRefreshing] = useState(false);
  const onManage = () => navigation.getParent()?.navigate('WalletList');

  const accounts = useListAccountsQuery(
    { walletId: activeWalletId ?? undefined, status: 'ACTIVE' },
    { skip: activeWalletId === null },
  );

  const handleRefresh = async () => {
    setIsRefreshing(true);
    try {
      await Promise.all([accounts.refetch(), refetchWallets?.()]);
    } finally {
      setIsRefreshing(false);
    }
  };

  const renderContent = () => {
    if (walletsLoading) return <SkeletonList rows={5} />;
    if (walletsError && !isNetworkError(walletsError)) {
      return (
        <StateView
          variant="error"
          error={new Error(t('errors.loadWalletsFailed'))}
          retryAction={refetchWallets}
        />
      );
    }

    if (activeWalletId === null) {
      return (
        <StateView
          variant="empty"
          icon={WalletIcon}
          title={t('home.noWalletTitle')}
          message={t('home.noWalletDescription')}
          primaryAction={{ label: t('wallets.newWallet'), onPress: onManage, icon: Plus }}
          testID="accounts-no-wallet"
        />
      );
    }

    if (accounts.isLoading) return <SkeletonList rows={5} />;
    if (accounts.isError && !isNetworkError(accounts.error)) {
      return (
        <StateView
          variant="error"
          error={accounts.error}
          retryAction={() => void accounts.refetch()}
          testID="accounts-error"
        />
      );
    }

    const items = accounts.data ?? [];

    // Before the first account there is no net worth to report, and three "—"
    // rows above the prompt read as a broken screen rather than a new one.
    if (items.length === 0) {
      return (
        <RefreshableScrollView
          testID="accounts-screen"
          contentContainerStyle={{ flexGrow: 1, padding: theme.spacing.md }}
          refreshing={isRefreshing}
          onRefresh={handleRefresh}
        >
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
            quickActions={
              permissions.canWrite
                ? ACCOUNT_TYPES.map((type) => ({
                    label: t(ACCOUNT_TYPE_LABEL_KEY[type]),
                    icon: ACCOUNT_ICON[type],
                    onPress: () => openModal('AddAccount', { walletId: activeWalletId ?? undefined, accountType: type }),
                  }))
                : undefined
            }
            testID="accounts-empty"
          />
        </RefreshableScrollView>
      );
    }

    const { assets, liabilities, netWorth } = netWorthByCurrency(items);

    return (
      <RefreshableScrollView
        testID="accounts-screen"
        contentContainerStyle={{ padding: theme.spacing.md, gap: theme.spacing.lg }}
        refreshing={isRefreshing}
        onRefresh={handleRefresh}
      >
        <View>
          <Text variant="label" tone="muted">
            {t('accounts.netWorth')}
          </Text>
          {netWorth.length === 0 ? (
            <Text tone="muted" style={{ marginTop: theme.spacing.xs }}>
              —
            </Text>
          ) : (
            netWorth.map((item) => (
              <Money
                key={item.currency}
                amount={item.amount}
                currency={item.currency}
                variant="heading"
                style={{ marginTop: theme.spacing.xs }}
              />
            ))
          )}
        </View>

        <View className="flex-row" style={{ gap: theme.spacing.md }}>
          <View className="flex-1">
            <Text variant="label" tone="muted">
              {t('accounts.assets')}
            </Text>
            {assets.length === 0 ? (
              <Text tone="muted" style={{ marginTop: theme.spacing.xs }}>
                —
              </Text>
            ) : (
              assets.map((item) => (
                <Money
                  key={item.currency}
                  amount={item.amount}
                  currency={item.currency}
                  type="INCOME"
                  variant="title"
                  style={{ marginTop: theme.spacing.xs }}
                />
              ))
            )}
          </View>
          <View className="flex-1">
            <Text variant="label" tone="muted">
              {t('accounts.liabilities')}
            </Text>
            {liabilities.length === 0 ? (
              <Text tone="muted" style={{ marginTop: theme.spacing.xs }}>
                —
              </Text>
            ) : (
              liabilities.map((item) => (
                <Money
                  key={item.currency}
                  amount={item.amount}
                  currency={item.currency}
                  type="EXPENSE"
                  variant="title"
                  style={{ marginTop: theme.spacing.xs }}
                />
              ))
            )}
          </View>
        </View>

        <View>
          <View
            className="flex-row justify-between items-center"
            style={{ marginBottom: theme.spacing.sm }}
          >
            <Text variant="title">{t('accounts.accountsLabel')}</Text>
            {permissions.canWrite ? (
              <Pressable
                testID="accounts-add-button"
                onPress={() => openModal('AddAccount', { walletId: activeWalletId ?? undefined })}
                className="flex-row items-center gap-xs"
                style={{
                  paddingVertical: theme.spacing.xs,
                  paddingHorizontal: theme.spacing.sm,
                  borderRadius: theme.radius.sm,
                }}
              >
                <Plus size={16} color={theme.colors.primary} />
                <Text variant="caption" weight="medium" style={{ color: theme.colors.primary }}>
                  {t('accounts.addAccount')}
                </Text>
              </Pressable>
            ) : null}
          </View>

          <View className="border-t" style={{ borderTopColor: theme.colors.border }}>
            {items.map((account, index) => (
              <View
                key={account.id}
                style={
                  index === 0
                    ? undefined
                    : { borderTopWidth: 1, borderTopColor: theme.colors.border }
                }
              >
                <ListItemEnter>
                  <AccountRow
                    account={account}
                    onPress={() =>
                      navigation.getParent()?.navigate('AccountDetail', { accountId: account.id })
                    }
                  />
                </ListItemEnter>
              </View>
            ))}
          </View>
        </View>
      </RefreshableScrollView>
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
  const syncStatus = useSelector(selectQueueEntryFor('account', account.id))?.status;

  return (
    <Pressable
      testID={`account-row-${account.id}`}
      onPress={onPress}
      className="flex-row items-center justify-between"
      style={{ paddingVertical: theme.spacing.sm }}
    >
      <View className="flex-row items-center" style={{ gap: theme.spacing.sm }}>
        <Icon size={18} color={theme.colors.textMuted} />
        <Text>{account.name}</Text>
        <SyncStatusDot status={syncStatus} />
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
  const assetsByCurrency = sumScaledByKey(
    accounts.filter(isAsset),
    (account) => account.currency,
    (account) => account.balance,
  );
  const liabilitiesByCurrency = sumScaledByKey(
    accounts.filter((account) => !isAsset(account)),
    (account) => account.currency,
    (account) => account.balance,
  );

  const currencies = new Set([...assetsByCurrency.keys(), ...liabilitiesByCurrency.keys()]);

  const assets = Array.from(assetsByCurrency.entries()).map(([currency, amount]) => ({
    currency,
    amount: formatMoney(amount),
  }));
  const liabilities = Array.from(liabilitiesByCurrency.entries()).map(([currency, amount]) => ({
    currency,
    amount: formatMoney(negate(amount)),
  }));
  const netWorth = Array.from(currencies).map((currency) => {
    const assetAmount = assetsByCurrency.get(currency) ?? ZERO;
    const liabilityAmount = liabilitiesByCurrency.get(currency) ?? ZERO;
    return {
      currency,
      amount: formatMoney(add(assetAmount, liabilityAmount)),
    };
  });

  return { assets, liabilities, netWorth };
}
