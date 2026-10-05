import { Archive, History, Landmark, LogOut, Plus, Settings, UsersRound } from 'lucide-react-native';
import { useState } from 'react';
import { Pressable, ScrollView, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { AccountStatus, WalletRole, type AccountResponse } from '@sora/contracts';

import { Card, closeOpenSwipeRow, ConfirmDialog, Money, Skeleton, StateView, SwipeableRow, Text } from '@/components';
import { useAuth, useTheme, useToast } from '@/app/providers';
import {
  useArchiveWalletMutation,
  useGetWalletQuery,
  useLeaveWalletMutation,
  useListAccountsQuery,
  useListMembersQuery,
} from '@/app/store';
import { accountSwipeActions, ArchiveAccountDialog } from '@/features/accounts';
import { getRoleLabel, isNetworkError, messageOf, permissionsFor } from '@/utils';
import { WalletEditCard } from './WalletEditCard.tsx';

type PendingAction = 'leave' | 'archive' | null;

export function WalletDetailPanel({
  walletId,
  onOpenMembers,
  onOpenActivity,
  onOpenAccount,
  onAddAccount,
  onOpenCategories,
  onWalletGone,
}: {
  walletId: string;
  onOpenMembers: () => void;
  onOpenActivity: () => void;
  onOpenAccount: (accountId: string) => void;
  onAddAccount: () => void;
  onOpenCategories: () => void;
  /** After leaving or archiving: this wallet is no longer the caller's to show. */
  onWalletGone: () => void;
}) {
  const theme = useTheme();
  const { t } = useTranslation();
  const { isGuest } = useAuth();
  const { showToast } = useToast();

  const wallet = useGetWalletQuery(walletId);
  const accounts = useListAccountsQuery({ walletId, status: AccountStatus.ACTIVE });
  // Sharing is out of scope for guest mode — see membersApi's note.
  const members = useListMembersQuery({ walletId }, { skip: isGuest });
  const [leaveWallet] = useLeaveWalletMutation();
  const [archiveWallet] = useArchiveWalletMutation();

  const [pendingAction, setPendingAction] = useState<PendingAction>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [archivingAccountId, setArchivingAccountId] = useState<string | null>(null);

  async function handleConfirmAction() {
    setActionError(null);
    try {
      if (pendingAction === 'leave') await leaveWallet(walletId).unwrap();
      else if (pendingAction === 'archive') await archiveWallet(walletId).unwrap();
      setPendingAction(null);
      onWalletGone();
    } catch (error) {
      setActionError(messageOf(error, t));
    }
  }

  const renderContent = () => {
    if (wallet.isLoading || accounts.isLoading) return         <View style={{ gap: theme.spacing.lg, paddingBottom: theme.spacing.xl }}>
          <View className="flex-row justify-between items-center">
            <Skeleton width={theme.sizes.skeletonWidth.xl} height={theme.sizes.skeletonLine.display} radius={theme.radius.sm} />
            <Skeleton width={theme.sizes.skeletonWidth.sm} height={theme.sizes.skeletonLine.title} radius={theme.radius.sm} />
          </View>
          
          <View className="flex-row justify-between items-center" style={{ marginTop: theme.spacing.sm }}>
            <Skeleton width={theme.sizes.skeletonWidth.md} height={theme.sizes.skeletonLine.label} radius={theme.radius.sm} />
            <Skeleton width={theme.iconSize.xxl} height={theme.iconSize.xxl} radius={theme.radius.pill} />
          </View>

          <View style={{ gap: theme.spacing.md }}>
            {Array.from({ length: 3 }).map((_, i) => (
              <View key={i} className="flex-row items-center justify-between">
                <View className="flex-row items-center" style={{ gap: theme.spacing.md }}>
                  <Skeleton width={theme.sizes.badge.lg} height={theme.sizes.badge.lg} radius={theme.radius.pill} />
                  <View style={{ gap: theme.spacing.xs }}>
                    <Skeleton width={theme.sizes.skeletonWidth.lg} height={theme.sizes.skeletonLine.body} radius={theme.radius.sm} />
                    <Skeleton width={theme.sizes.skeletonWidth.sm} height={theme.sizes.skeletonLine.caption} radius={theme.radius.sm} />
                  </View>
                </View>
                <Skeleton width={theme.sizes.skeletonWidth.md} height={theme.sizes.skeletonLine.body} radius={theme.radius.sm} />
              </View>
            ))}
          </View>
        </View>;
    if (wallet.isError && !isNetworkError(wallet.error)) {
      return <StateView variant="error" error={wallet.error} retryAction={() => void wallet.refetch()} />;
    }

    const data = wallet.data;
    if (data === undefined) {
      return <StateView variant="error" error={new Error(t('wallets.walletNotFound', 'Wallet not found'))} />;
    }

    const permissions = permissionsFor(data.role);
    const canShare = permissions.canAdminister && !isGuest;
    const canLeave = data.role !== WalletRole.OWNER && !isGuest;

    return (
      <>
        <View className="flex-row justify-between items-center">
          <View>
            {data.balances.map((total) => (
              <Money key={total.currency} amount={total.amount} currency={total.currency} variant="heading" />
            ))}
          </View>
          <View className="flex-row items-center" style={{ gap: theme.spacing.md }}>
            {!isGuest ? (
              <Pressable
                testID="wallet-detail-members"
                onPress={onOpenMembers}
                className="flex-row items-center"
                style={{ gap: theme.spacing.xs }}
              >
                <UsersRound size={theme.iconSize.md} color={theme.colors.textMuted} />
                <Text tone="muted">{data.memberCount}</Text>
              </Pressable>
            ) : null}
            {canShare ? (
              <>
                <Pressable testID="wallet-detail-activity" hitSlop={theme.sizes.hitSlop.lg} onPress={onOpenActivity}>
                  <History size={theme.iconSize.xxl} color={theme.colors.textMuted} />
                </Pressable>
                <Pressable testID="wallet-detail-categories" hitSlop={theme.sizes.hitSlop.lg} onPress={onOpenCategories}>
                  <Settings size={theme.iconSize.xxl} color={theme.colors.textMuted} />
                </Pressable>
              </>
            ) : null}
          </View>
        </View>

        <View className="flex-row justify-between items-center">
          <Text variant="label" tone="muted">
            {t('wallets.accounts')}
          </Text>
          {permissions.canWrite ? (
            <Pressable testID="wallet-detail-add-account" hitSlop={theme.sizes.hitSlop.lg} onPress={onAddAccount}>
              <Plus size={theme.iconSize.xl} color={theme.colors.primary} />
            </Pressable>
          ) : null}
        </View>

        {(accounts.data ?? []).length === 0 ? (
          <StateView
            variant="empty"
            icon={Landmark}
            title={t('accounts.noAccountsTitle')}
            message={t('accounts.noAccountsMessage')}
            primaryAction={permissions.canWrite ? { label: t('accounts.addAccount'), onPress: onAddAccount } : undefined}
            entrance="none"
          />
        ) : (
          (accounts.data ?? []).map((account) => (
            <SwipeableRow
              key={account.id}
              radius={theme.radius.lg}
              onActivate={() => onOpenAccount(account.id)}
              actions={
                permissions.canWrite
                  ? accountSwipeActions(t, { onOpen: () => onOpenAccount(account.id), onArchive: () => setArchivingAccountId(account.id) })
                  : []
              }
            >
              <AccountItem account={account} onPress={() => onOpenAccount(account.id)} />
            </SwipeableRow>
          ))
        )}

        {members.data !== undefined && members.data.length > 1 ? (
          <View>
            <Text variant="label" tone="muted" style={{ marginBottom: theme.spacing.sm }}>
              {t('wallets.members')}
            </Text>
            {members.data.map((member) => (
              <View key={member.id} className="flex-row justify-between" style={{ paddingVertical: theme.spacing.xs }}>
                <Text>{member.displayName}</Text>
                <Text tone="muted">{member.relationLabel ?? getRoleLabel(member.role, t)}</Text>
              </View>
            ))}
          </View>
        ) : null}

        {canShare ? <WalletEditCard key={data.id} wallet={data} /> : null}

        {canLeave || canShare ? (
          <View style={{ gap: theme.spacing.sm, marginTop: theme.spacing.md }}>
            <Text variant="label" tone="muted">
              {t('wallets.walletActions')}
            </Text>
            {actionError !== null ? <Text tone="danger">{actionError}</Text> : null}
            {canLeave ? (
              <Pressable
                testID="btn-leave-wallet"
                onPress={() => {
                  setActionError(null);
                  setPendingAction('leave');
                }}
                className="flex-row items-center"
                style={{ gap: theme.spacing.sm }}
              >
                <LogOut size={theme.iconSize.lg} color={theme.colors.danger} />
                <Text tone="danger">{t('wallets.leaveWallet')}</Text>
              </Pressable>
            ) : null}
            {canShare ? (
              <Pressable
                testID="btn-archive-wallet"
                onPress={() => {
                  setActionError(null);
                  setPendingAction('archive');
                }}
                className="flex-row items-center"
                style={{ gap: theme.spacing.sm }}
              >
                <Archive size={theme.iconSize.lg} color={theme.colors.danger} />
                <Text tone="danger">{t('wallets.archiveWallet')}</Text>
              </Pressable>
            ) : null}
          </View>
        ) : null}
      </>
    );
  };

  return (
    <>
      <ScrollView
        testID="wallet-detail"
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        onScrollBeginDrag={closeOpenSwipeRow}
        contentContainerStyle={{ gap: theme.spacing.md, paddingBottom: theme.spacing.md }}
      >
        {renderContent()}
      </ScrollView>

      <ConfirmDialog
        visible={pendingAction !== null}
        title={pendingAction === 'leave' ? t('wallets.leaveConfirmTitle') : t('wallets.archiveConfirmTitle')}
        message={pendingAction === 'leave' ? t('wallets.leaveConfirmBody') : t('wallets.archiveConfirmBody')}
        confirmLabel={pendingAction === 'leave' ? t('wallets.leaveWallet') : t('wallets.archiveWallet')}
        destructive
        onConfirm={() => void handleConfirmAction()}
        onCancel={() => setPendingAction(null)}
      />
      <ArchiveAccountDialog
        accountId={archivingAccountId}
        onCancel={() => setArchivingAccountId(null)}
        onArchived={() => setArchivingAccountId(null)}
        onError={(message) => {
          setArchivingAccountId(null);
          showToast(message, 'error');
        }}
      />
    </>
  );
}

function AccountItem({ account, onPress }: { account: AccountResponse; onPress: () => void }) {
  const theme = useTheme();
  return (
    <Pressable testID={`wallet-detail-account-${account.id}`} onPress={onPress}>
      <Card>
        <View className="flex-row justify-between items-center">
          <View className="flex-row items-center" style={{ gap: theme.spacing.sm }}>
            <Landmark size={theme.iconSize.lg} color={theme.colors.textMuted} />
            <Text>{account.name}</Text>
          </View>
          <Money amount={account.balance} currency={account.currency} weight="semibold" />
        </View>
      </Card>
    </Pressable>
  );
}
