import { Archive, History, Landmark, LogOut, Plus, Settings, UsersRound } from 'lucide-react-native';
import { useState } from 'react';
import { Pressable, ScrollView, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { WalletRole, type AccountResponse } from '@sora/contracts';

import { Card, ConfirmDialog, Money, SkeletonList, StateView, Text } from '@/components';
import { useAuth, useTheme } from '@/app/providers';
import {
  useArchiveWalletMutation,
  useGetWalletQuery,
  useLeaveWalletMutation,
  useListAccountsQuery,
  useListMembersQuery,
} from '@/app/store';
import { getRoleLabel, isNetworkError, messageOf, permissionsFor } from '@/utils';

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

  const wallet = useGetWalletQuery(walletId);
  const accounts = useListAccountsQuery({ walletId, status: 'ACTIVE' });
  // Sharing is out of scope for guest mode — see membersApi's note.
  const members = useListMembersQuery({ walletId }, { skip: isGuest });
  const [leaveWallet] = useLeaveWalletMutation();
  const [archiveWallet] = useArchiveWalletMutation();

  const [pendingAction, setPendingAction] = useState<PendingAction>(null);
  const [actionError, setActionError] = useState<string | null>(null);

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
    if (wallet.isLoading || accounts.isLoading) return <SkeletonList rows={5} />;
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
                <UsersRound size={16} color={theme.colors.textMuted} />
                <Text tone="muted">{data.memberCount}</Text>
              </Pressable>
            ) : null}
            {canShare ? (
              <>
                <Pressable testID="wallet-detail-activity" hitSlop={12} onPress={onOpenActivity}>
                  <History size={22} color={theme.colors.textMuted} />
                </Pressable>
                <Pressable testID="wallet-detail-categories" hitSlop={12} onPress={onOpenCategories}>
                  <Settings size={22} color={theme.colors.textMuted} />
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
            <Pressable testID="wallet-detail-add-account" hitSlop={12} onPress={onAddAccount}>
              <Plus size={20} color={theme.colors.primary} />
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
            <AccountRow key={account.id} account={account} onPress={() => onOpenAccount(account.id)} />
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
                <LogOut size={18} color={theme.colors.danger} />
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
                <Archive size={18} color={theme.colors.danger} />
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
    </>
  );
}

function AccountRow({ account, onPress }: { account: AccountResponse; onPress: () => void }) {
  const theme = useTheme();
  return (
    <Pressable testID={`wallet-detail-account-${account.id}`} onPress={onPress}>
      <Card>
        <View className="flex-row justify-between items-center">
          <View className="flex-row items-center" style={{ gap: theme.spacing.sm }}>
            <Landmark size={18} color={theme.colors.textMuted} />
            <Text>{account.name}</Text>
          </View>
          <Money amount={account.balance} currency={account.currency} weight="semibold" />
        </View>
      </Card>
    </Pressable>
  );
}
