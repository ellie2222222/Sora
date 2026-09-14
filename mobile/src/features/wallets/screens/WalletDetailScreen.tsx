import { Archive, History, Landmark, LogOut, Plus, Settings, UsersRound } from 'lucide-react-native';
import { useState } from 'react';
import { Pressable, ScrollView, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { WalletRole, type AccountResponse } from '@sora/contracts';

import { Card, ConfirmDialog, Money, StateView, Text } from '../../../components/index.ts';
import { SkeletonList } from '../../../components/Skeleton.tsx';
import { useAuth } from '../../../app/providers/AuthProvider.tsx';
import { useTheme } from '../../../app/providers/ThemeProvider.tsx';
import { useListAccountsQuery } from '../../../app/store/api/accountsApi.ts';
import { useLeaveWalletMutation, useListMembersQuery } from '../../../app/store/api/membersApi.ts';
import { useArchiveWalletMutation, useGetWalletQuery } from '../../../app/store/api/walletsApi.ts';
import { messageOf } from '../../../utils/errors.ts';
import { permissionsFor, ROLE_LABELS } from '../../../utils/roles.ts';
import type { AppStackScreenProps } from '../../../app/navigation/types.ts';

type PendingAction = 'leave' | 'archive' | null;

export function WalletDetailScreen({ route, navigation }: AppStackScreenProps<'WalletDetail'>) {
  const theme = useTheme();
  const { t } = useTranslation();
  const { walletId } = route.params;
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
      navigation.navigate('WalletList');
    } catch (error) {
      setActionError(messageOf(error, t));
    }
  }

  const renderContent = () => {
    if (wallet.isLoading || accounts.isLoading) return <SkeletonList rows={5} />;
    if (wallet.isError) {
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
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
          <Text variant="heading">{data.isOwn ? data.name : data.relationLabel ?? data.name}</Text>
          {canShare ? (
            <View style={{ flexDirection: 'row', gap: theme.spacing.md }}>
              <Pressable testID="wallet-detail-activity" onPress={() => navigation.navigate('WalletActivity', { walletId })}>
                <History size={22} color={theme.colors.textMuted} />
              </Pressable>
              <Pressable testID="wallet-detail-settings" onPress={() => navigation.navigate('WalletMembers', { walletId })}>
                <Settings size={22} color={theme.colors.textMuted} />
              </Pressable>
            </View>
          ) : null}
        </View>

        <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
          {data.balances.map((total) => (
            <Money key={total.currency} amount={total.amount} currency={total.currency} variant="heading" />
          ))}
          {!isGuest ? (
            <Pressable
              testID="wallet-detail-members"
              onPress={() => navigation.navigate('WalletMembers', { walletId })}
              style={{ flexDirection: 'row', alignItems: 'center', gap: theme.spacing.xs }}
            >
              <UsersRound size={16} color={theme.colors.textMuted} />
              <Text tone="muted">{data.memberCount}</Text>
            </Pressable>
          ) : null}
        </View>

        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
          <Text variant="label" tone="muted">
            {t('wallets.accounts')}
          </Text>
          {permissions.canWrite ? (
            <Pressable testID="wallet-detail-add-account" onPress={() => navigation.navigate('AddAccount', { walletId })}>
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
            primaryAction={
              permissions.canWrite
                ? { label: t('accounts.addAccount'), onPress: () => navigation.navigate('AddAccount', { walletId }) }
                : undefined
            }
          />
        ) : (
          (accounts.data ?? []).map((account) => (
            <AccountRow key={account.id} account={account} onPress={() => navigation.navigate('AccountDetail', { accountId: account.id })} />
          ))
        )}

        {members.data !== undefined && members.data.length > 1 ? (
          <View>
            <Text variant="label" tone="muted" style={{ marginBottom: theme.spacing.sm }}>
              {t('wallets.members')}
            </Text>
            {members.data.map((member) => (
              <View
                key={member.id}
                style={{ flexDirection: 'row', justifyContent: 'space-between', paddingVertical: theme.spacing.xs }}
              >
                <Text>{member.displayName}</Text>
                <Text tone="muted">{member.relationLabel ?? ROLE_LABELS[member.role]}</Text>
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
                testID="wallet-detail-leave"
                onPress={() => {
                  setActionError(null);
                  setPendingAction('leave');
                }}
                style={{ flexDirection: 'row', alignItems: 'center', gap: theme.spacing.sm }}
              >
                <LogOut size={18} color={theme.colors.danger} />
                <Text tone="danger">{t('wallets.leaveWallet')}</Text>
              </Pressable>
            ) : null}
            {canShare ? (
              <Pressable
                testID="wallet-detail-archive"
                onPress={() => {
                  setActionError(null);
                  setPendingAction('archive');
                }}
                style={{ flexDirection: 'row', alignItems: 'center', gap: theme.spacing.sm }}
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
      <ScrollView contentContainerStyle={{ padding: theme.spacing.md, gap: theme.spacing.md }}>
        {renderContent()}
      </ScrollView>

      <ConfirmDialog
        visible={pendingAction !== null}
        title={pendingAction === 'leave' ? t('wallets.leaveConfirmTitle') : t('wallets.archiveConfirmTitle')}
        message={
          pendingAction === 'leave'
            ? t('wallets.leaveConfirmBody')
            : t('wallets.archiveConfirmBody')
        }
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
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: theme.spacing.sm }}>
            <Landmark size={18} color={theme.colors.textMuted} />
            <Text>{account.name}</Text>
          </View>
          <Money amount={account.balance} currency={account.currency} weight="semibold" />
        </View>
      </Card>
    </Pressable>
  );
}
