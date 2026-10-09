import { useState } from 'react';
import { Landmark, Plus } from 'lucide-react-native';
import { Pressable, View } from 'react-native';
import { useSelector } from 'react-redux';
import { useTranslation } from 'react-i18next';
import {
  ACCOUNT_TYPES,
  AccountStatus,
  add,
  formatMoney,
  isNegative,
  negate,
  parseMoney,
  ZERO,
  type AccountResponse,
} from '@sora/contracts';

import { Money, SectionLabel, Skeleton, StateView, SwipeableRow, SyncStatusDot, Text } from '@/components';
import { useModal, useTheme, useToast } from '@/app/providers';
import { selectQueueEntryFor, useListAccountsQuery } from '@/app/store';
import { isNetworkError, sumScaledByKey } from '@/utils';
import { ACCOUNT_ICON, ACCOUNT_TYPE_LABEL_KEY } from './AccountPicker.tsx';
import { accountSwipeActions } from './accountSwipeActions.ts';
import { ArchiveAccountDialog } from './ArchiveAccountDialog.tsx';

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
  const { showToast } = useToast();
  const accounts = useListAccountsQuery({ walletId, status: AccountStatus.ACTIVE });
  const [archivingId, setArchivingId] = useState<string | null>(null);

  // `currentData` is empty while another wallet's accounts load, where `data` would still show the old wallet's.
  if (accounts.currentData === undefined && accounts.isFetching) {
    return (
      <View style={{ gap: theme.spacing.xl }}>
        <View style={{ gap: theme.spacing.xs }}>
          <SectionLabel>{t('accounts.netWorth')}</SectionLabel>
          <Skeleton width={theme.sizes.skeletonWidth.xxl} height={theme.sizes.skeletonLine.display} radius={theme.radius.sm} />
          <View className="flex-row" style={{ gap: theme.spacing.xl, marginTop: theme.spacing.sm }}>
            <Skeleton width={theme.sizes.skeletonWidth.lg} height={theme.sizes.skeletonLine.label} radius={theme.radius.sm} />
            <Skeleton width={theme.sizes.skeletonWidth.lg} height={theme.sizes.skeletonLine.label} radius={theme.radius.sm} />
          </View>
        </View>

        <View style={{ gap: theme.spacing.xs }}>
          <SectionLabel>{t('accounts.accountsLabel')}</SectionLabel>
          {[1, 2, 3].map((key) => (
            <AccountItemSkeleton key={key} />
          ))}
        </View>
      </View>
    );
  }
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

  const items = accounts.currentData ?? [];

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

  const [primaryNetWorth, ...otherNetWorth] = netWorth;

  return (
    <View testID="section-accounts" style={{ gap: theme.spacing.xl }}>
      <View style={{ gap: theme.spacing.xs }}>
        <SectionLabel>{t('accounts.netWorth')}</SectionLabel>
        {primaryNetWorth !== undefined ? (
          <Money
            amount={primaryNetWorth.amount}
            currency={primaryNetWorth.currency}
            weight="bold"
            numberOfLines={1}
            adjustsFontSizeToFit
            style={{ fontSize: theme.fontSize.display }}
            testID="accounts-net-worth"
          />
        ) : null}
        {/* BR-07: each further currency is its own figure, never added to the first. */}
        {otherNetWorth.map((item) => (
          <Money key={item.currency} amount={item.amount} currency={item.currency} weight="semibold" style={{ fontSize: theme.fontSize.lg, color: theme.colors.textMuted }} />
        ))}

        <View className="flex-row flex-wrap" style={{ columnGap: theme.spacing.xl, rowGap: theme.spacing.xs, marginTop: theme.spacing.sm }}>
          <PositionFigure label={t('accounts.assets')} totals={assets} dotColor={theme.colors.income} />
          <PositionFigure label={t('accounts.liabilities')} totals={liabilities} dotColor={theme.colors.expense} />
        </View>
      </View>

      <View style={{ gap: theme.spacing.xs }}>
        <SectionLabel
          action={
            canWrite ? (
              <Pressable
                testID="btn-add-account"
                accessibilityRole="button"
                onPress={() => openModal('AddAccount', { walletId })}
                hitSlop={theme.sizes.hitSlop.lg}
                className="flex-row items-center"
                style={{ gap: theme.spacing.xxs }}
              >
                <Plus size={theme.iconSize.sm} color={theme.colors.primary} />
                <Text variant="label" weight="semibold" style={{ color: theme.colors.primary }}>
                  {t('accounts.addAccount')}
                </Text>
              </Pressable>
            ) : undefined
          }
        >
          {t('accounts.accountsLabel')}
        </SectionLabel>

        <View>
          {items.map((account, index) => (
            <View key={account.id}>
              {/* Inset to the name column, so the icons read as one column rather than a ruled table. */}
              {index > 0 ? (
                <View style={{ height: theme.borderWidth.thin, backgroundColor: theme.colors.border, marginLeft: theme.sizes.badge.md + theme.spacing.md }} />
              ) : null}
              <SwipeableRow
                backgroundColor={theme.colors.background}
                onActivate={() => onOpenAccount(account.id)}
                actions={
                  canWrite
                    ? accountSwipeActions(t, { onOpen: () => onOpenAccount(account.id), onArchive: () => setArchivingId(account.id) })
                    : []
                }
              >
                <AccountItem account={account} onPress={() => onOpenAccount(account.id)} />
              </SwipeableRow>
            </View>
          ))}
        </View>
      </View>
      <ArchiveAccountDialog
        accountId={archivingId}
        onCancel={() => setArchivingId(null)}
        onArchived={() => setArchivingId(null)}
        onError={(message) => {
          setArchivingId(null);
          showToast(message, 'error');
        }}
      />
    </View>
  );
}

/** Assets or liabilities, a supporting figure under net worth: a coloured dot marks which, not the number. */
function PositionFigure({ label, totals, dotColor }: { label: string; totals: { currency: string; amount: string }[]; dotColor: string }) {
  const theme = useTheme();
  const empty = totals.length === 0;
  return (
    <View style={{ gap: theme.spacing.xxs }}>
      <View className="flex-row items-center" style={{ gap: theme.spacing.xs }}>
        <View style={{ width: theme.sizes.dot.sm, height: theme.sizes.dot.sm, borderRadius: theme.radius.pill, backgroundColor: empty ? theme.colors.border : dotColor }} />
        <Text variant="caption" tone="muted">
          {label}
        </Text>
      </View>
      {empty ? (
        <Text variant="label" tone="faint">
          —
        </Text>
      ) : (
        totals.map((item) => <Money key={item.currency} amount={item.amount} currency={item.currency} variant="label" weight="semibold" />)
      )}
    </View>
  );
}

function AccountItem({ account, onPress }: { account: AccountResponse; onPress: () => void }) {
  const theme = useTheme();
  const { t } = useTranslation();
  const Icon = ACCOUNT_ICON[account.type];
  const syncStatus = useSelector(selectQueueEntryFor('account', account.id))?.status;

  return (
    <Pressable
      testID={`row-account-${account.id}`}
      accessibilityRole="button"
      onPress={onPress}
      className="flex-row items-center"
      style={{ gap: theme.spacing.md, minHeight: theme.sizes.listRowMinHeight, paddingVertical: theme.spacing.sm }}
    >
      <View
        className="items-center justify-center"
        style={{ width: theme.sizes.badge.md, height: theme.sizes.badge.md, borderRadius: theme.radius.pill, backgroundColor: theme.colors.surfaceMuted }}
      >
        <Icon size={theme.iconSize.md} color={theme.colors.textMuted} />
      </View>
      <View style={{ flex: 1, gap: theme.spacing.xxs }}>
        <View className="flex-row items-center" style={{ gap: theme.spacing.xs }}>
          <Text weight="medium" numberOfLines={1} style={{ flexShrink: 1 }}>
            {account.name}
          </Text>
          <SyncStatusDot status={syncStatus} />
        </View>
        <Text variant="caption" tone="muted" numberOfLines={1}>
          {t(ACCOUNT_TYPE_LABEL_KEY[account.type])}
        </Text>
      </View>
      <Money amount={account.balance} currency={account.currency} weight="semibold" numberOfLines={1} />
    </Pressable>
  );
}

function AccountItemSkeleton() {
  const theme = useTheme();

  return (
    <View className="flex-row items-center" style={{ gap: theme.spacing.md, minHeight: theme.sizes.listRowMinHeight, paddingVertical: theme.spacing.sm }}>
      <Skeleton width={theme.sizes.badge.md} height={theme.sizes.badge.md} radius={theme.radius.pill} />
      <View style={{ flex: 1, gap: theme.spacing.xs }}>
        <Skeleton width={theme.sizes.skeletonWidth.xl} height={theme.sizes.skeletonLine.body} radius={theme.radius.sm} />
        <Skeleton width={theme.sizes.skeletonWidth.sm} height={theme.sizes.skeletonLine.caption} radius={theme.radius.sm} />
      </View>
      <Skeleton width={theme.sizes.skeletonWidth.md} height={theme.sizes.skeletonLine.body} radius={theme.radius.sm} />
    </View>
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
