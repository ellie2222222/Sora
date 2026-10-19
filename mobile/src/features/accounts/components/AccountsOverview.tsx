import { useState } from 'react';
import { Landmark, Plus } from 'lucide-react-native';
import { Pressable, View } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { useSelector } from 'react-redux';
import { useTranslation } from 'react-i18next';
import { ACCOUNT_TYPES, AccountStatus, type AccountResponse } from '@sora/contracts';

import { Money, SectionLabel, Skeleton, StateView, SwipeableRow, SyncStatusDot, Text } from '@/components';
import { useModal, useTheme, useToast } from '@/app/providers';
import { selectQueueEntryFor, useListAccountsQuery } from '@/app/store';
import { isNetworkError } from '@/utils';
import { accountTint } from '../accountTint.ts';
import { netWorthByCurrency } from '../netWorth.ts';
import { AccountBadge } from './AccountBadge.tsx';
import { NetWorthSummary, NetWorthSummarySkeleton } from './NetWorthSummary.tsx';
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
  if (accounts.currentData === undefined && accounts.isFetching) return <AccountsOverviewSkeleton />;
  if (accounts.isError && (!isNetworkError(accounts.error) || accounts.currentData === undefined)) {
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

  return (
    <View testID="section-accounts" style={{ gap: theme.spacing.xl }}>
      <NetWorthSummary walletId={walletId} netWorth={netWorth} assets={assets} liabilities={liabilities} />

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

        <View style={{ gap: theme.spacing.sm }}>
          {items.map((account, index) => {
            const tint = accountTint(account.id, theme.accountTints);
            return (
              // `entering` runs on mount only, so a refetch or a balance change never replays it.
              <Animated.View
                key={account.id}
                entering={FadeInDown.duration(CARD_ENTER_MS).delay(Math.min(index, CARD_STAGGER_CAP) * CARD_STAGGER_MS)}
                testID={`card-account-${account.id}`}
                style={{
                  borderRadius: theme.radius.lg,
                  borderWidth: theme.borderWidth.thin,
                  borderColor: theme.colors.border,
                  overflow: 'hidden',
                }}
              >
                <SwipeableRow
                  backgroundColor={tint.surface}
                  onActivate={() => onOpenAccount(account.id)}
                  actions={
                    canWrite
                      ? accountSwipeActions(t, { onOpen: () => onOpenAccount(account.id), onArchive: () => setArchivingId(account.id) })
                      : []
                  }
                >
                  <AccountItem account={account} onPress={() => onOpenAccount(account.id)} />
                </SwipeableRow>
              </Animated.View>
            );
          })}
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

const CARD_ENTER_MS = 240;
const CARD_STAGGER_MS = 40;
/** Past a few cards the stagger would hold the last ones back for no reason. */
const CARD_STAGGER_CAP = 5;

function AccountItem({ account, onPress }: { account: AccountResponse; onPress: () => void }) {
  const theme = useTheme();
  const { t } = useTranslation();
  const syncStatus = useSelector(selectQueueEntryFor('account', account.id))?.status;

  return (
    <Pressable
      testID={`row-account-${account.id}`}
      accessibilityRole="button"
      onPress={onPress}
      className="flex-row items-center"
      style={{
        gap: theme.spacing.md,
        minHeight: theme.sizes.listRowMinHeight,
        paddingVertical: theme.spacing.md,
        paddingHorizontal: theme.spacing.lg,
      }}
    >
      <AccountBadge accountId={account.id} type={account.type} />
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
      <Money amount={account.balance} currency={account.currency} weight="semibold" numberOfLines={1} style={{ fontSize: theme.fontSize.lg }} />
    </Pressable>
  );
}

export function AccountsOverviewSkeleton() {
  const theme = useTheme();
  const { t } = useTranslation();

  return (
    <View style={{ gap: theme.spacing.xl }}>
      <NetWorthSummarySkeleton />

      <View style={{ gap: theme.spacing.xs }}>
        <SectionLabel>{t('accounts.accountsLabel')}</SectionLabel>
        <View style={{ gap: theme.spacing.sm }}>
          {[1, 2, 3].map((key) => (
            <AccountItemSkeleton key={key} />
          ))}
        </View>
      </View>
    </View>
  );
}

function AccountItemSkeleton() {
  const theme = useTheme();

  return (
    <View
      className="flex-row items-center"
      style={{
        gap: theme.spacing.md,
        minHeight: theme.sizes.listRowMinHeight,
        paddingVertical: theme.spacing.md,
        paddingHorizontal: theme.spacing.lg,
        borderRadius: theme.radius.lg,
        borderWidth: theme.borderWidth.thin,
        borderColor: theme.colors.border,
      }}
    >
      <Skeleton width={theme.sizes.badge.md} height={theme.sizes.badge.md} radius={theme.radius.pill} />
      <View style={{ flex: 1, gap: theme.spacing.xs }}>
        <Skeleton width={theme.sizes.skeletonWidth.xl} height={theme.sizes.skeletonLine.body} radius={theme.radius.sm} />
        <Skeleton width={theme.sizes.skeletonWidth.sm} height={theme.sizes.skeletonLine.caption} radius={theme.radius.sm} />
      </View>
      <Skeleton width={theme.sizes.skeletonWidth.md} height={theme.sizes.skeletonLine.body} radius={theme.radius.sm} />
    </View>
  );
}
