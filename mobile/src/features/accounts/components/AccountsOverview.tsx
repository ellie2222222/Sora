import { Landmark, Plus } from 'lucide-react-native';
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

import { ListItemEnter, Money, SkeletonList, StateView, SyncStatusDot, Text } from '@/components';
import { useModal, useTheme } from '@/app/providers';
import { selectQueueEntryFor, useListAccountsQuery } from '@/app/store';
import { isNetworkError, sumScaledByKey } from '@/utils';
import { ACCOUNT_ICON, ACCOUNT_TYPE_LABEL_KEY } from './AccountPicker.tsx';

/** A wallet's accounts with its net worth, and the entry point for adding one. */
export function AccountsOverview({
  walletId,
  canWrite,
  onOpenAccount,
}: {
  walletId: string;
  canWrite: boolean;
  onOpenAccount: (accountId: string) => void;
}) {
  const theme = useTheme();
  const { t } = useTranslation();
  const { openModal } = useModal();
  const accounts = useListAccountsQuery({ walletId, status: 'ACTIVE' });

  if (accounts.isLoading) return <SkeletonList rows={3} />;
  if (accounts.isError && !isNetworkError(accounts.error)) {
    return (
      <StateView
        variant="error"
        error={accounts.error}
        retryAction={() => void accounts.refetch()}
        testID="accounts-error"
        entrance="none"
      />
    );
  }

  const items = accounts.data ?? [];

  // Before the first account there is no net worth to report, and three "—"
  // rows above the prompt read as a broken screen rather than a new one.
  if (items.length === 0) {
    return (
      <StateView
        variant="empty"
        icon={Landmark}
        title={t('accounts.noAccountsTitle')}
        message={t('accounts.noAccountsMessage')}
        primaryAction={
          canWrite ? { label: t('accounts.addAccount'), onPress: () => openModal('AddAccount', { walletId }), icon: Plus } : undefined
        }
        quickActions={
          canWrite
            ? ACCOUNT_TYPES.map((type) => ({
                label: t(ACCOUNT_TYPE_LABEL_KEY[type]),
                icon: ACCOUNT_ICON[type],
                onPress: () => openModal('AddAccount', { walletId, accountType: type }),
              }))
            : undefined
        }
        testID="accounts-empty"
        entrance="none"
      />
    );
  }

  const { assets, liabilities, netWorth } = netWorthByCurrency(items);

  return (
    <View testID="section-accounts" style={{ gap: theme.spacing.lg }}>
      <View>
        <Text variant="label" tone="muted">
          {t('accounts.netWorth')}
        </Text>
        {netWorth.map((item) => (
          <Money key={item.currency} amount={item.amount} currency={item.currency} variant="heading" style={{ marginTop: theme.spacing.xs }} />
        ))}
      </View>

      <View className="flex-row" style={{ gap: theme.spacing.md }}>
        <TotalsColumn label={t('accounts.assets')} totals={assets} type="INCOME" />
        <TotalsColumn label={t('accounts.liabilities')} totals={liabilities} type="EXPENSE" />
      </View>

      <View>
        <View className="flex-row justify-between items-center" style={{ marginBottom: theme.spacing.sm }}>
          <Text variant="title">{t('accounts.accountsLabel')}</Text>
          {canWrite ? (
            <Pressable
              testID="btn-add-account"
              onPress={() => openModal('AddAccount', { walletId })}
              className="flex-row items-center gap-xs"
              style={{ paddingVertical: theme.spacing.xs, paddingHorizontal: theme.spacing.sm, borderRadius: theme.radius.sm }}
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
            <View key={account.id} style={index === 0 ? undefined : { borderTopWidth: 1, borderTopColor: theme.colors.border }}>
              <ListItemEnter>
                <AccountRow account={account} onPress={() => onOpenAccount(account.id)} />
              </ListItemEnter>
            </View>
          ))}
        </View>
      </View>
    </View>
  );
}

function TotalsColumn({
  label,
  totals,
  type,
}: {
  label: string;
  totals: { currency: string; amount: string }[];
  type: 'INCOME' | 'EXPENSE';
}) {
  const theme = useTheme();
  return (
    <View className="flex-1">
      <Text variant="label" tone="muted">
        {label}
      </Text>
      {totals.length === 0 ? (
        <Text tone="muted" style={{ marginTop: theme.spacing.xs }}>
          —
        </Text>
      ) : (
        totals.map((item) => (
          <Money key={item.currency} amount={item.amount} currency={item.currency} type={type} variant="title" style={{ marginTop: theme.spacing.xs }} />
        ))
      )}
    </View>
  );
}

function AccountRow({ account, onPress }: { account: AccountResponse; onPress: () => void }) {
  const theme = useTheme();
  const Icon = ACCOUNT_ICON[account.type];
  const syncStatus = useSelector(selectQueueEntryFor('account', account.id))?.status;

  return (
    <Pressable
      testID={`row-account-${account.id}`}
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
  const assetsByCurrency = sumScaledByKey(accounts.filter(isAsset), (account) => account.currency, (account) => account.balance);
  const liabilitiesByCurrency = sumScaledByKey(
    accounts.filter((account) => !isAsset(account)),
    (account) => account.currency,
    (account) => account.balance,
  );

  const currencies = new Set([...assetsByCurrency.keys(), ...liabilitiesByCurrency.keys()]);

  const assets = Array.from(assetsByCurrency.entries()).map(([currency, amount]) => ({ currency, amount: formatMoney(amount) }));
  const liabilities = Array.from(liabilitiesByCurrency.entries()).map(([currency, amount]) => ({
    currency,
    amount: formatMoney(negate(amount)),
  }));
  const netWorth = Array.from(currencies).map((currency) => ({
    currency,
    amount: formatMoney(add(assetsByCurrency.get(currency) ?? ZERO, liabilitiesByCurrency.get(currency) ?? ZERO)),
  }));

  return { assets, liabilities, netWorth };
}
