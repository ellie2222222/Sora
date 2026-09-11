import { Archive, History, Landmark, LogOut, Plus, Settings, UsersRound } from 'lucide-react-native';
import { useState } from 'react';
import { Pressable, ScrollView, View } from 'react-native';
import type { AccountResponse } from '@sora/contracts';

import { Card, ConfirmDialog, EmptyState, ErrorState, Money, Text } from '../../../components/index.ts';
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

  if (wallet.isLoading || accounts.isLoading) return <SkeletonList rows={5} />;
  if (wallet.isError) return <ErrorState error={wallet.error} onRetry={() => void wallet.refetch()} />;

  const data = wallet.data;
  if (data === undefined) return null;

  const permissions = permissionsFor(data.role);
  // Guest mode fabricates an OWNER role, so every sharing affordance below
  // would otherwise render with nothing behind it (no members, no audit log,
  // no archive path in guestWalletsApi).
  const canShare = permissions.canAdminister && !isGuest;
  const canLeave = data.role !== 'OWNER' && !isGuest;

  async function handleConfirmAction() {
    setActionError(null);
    try {
      if (pendingAction === 'leave') await leaveWallet(walletId).unwrap();
      else if (pendingAction === 'archive') await archiveWallet(walletId).unwrap();
      setPendingAction(null);
      navigation.navigate('WalletList');
    } catch (error) {
      setActionError(messageOf(error));
    }
  }

  return (
    <ScrollView contentContainerStyle={{ padding: theme.spacing.md, gap: theme.spacing.md }}>
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
          Accounts
        </Text>
        {permissions.canWrite ? (
          <Pressable testID="wallet-detail-add-account" onPress={() => navigation.navigate('AddAccount', { walletId })}>
            <Plus size={20} color={theme.colors.primary} />
          </Pressable>
        ) : null}
      </View>

      {(accounts.data ?? []).length === 0 ? (
        <EmptyState
          icon={Landmark}
          title="No accounts yet"
          description="Add a bank account, cash, or an e-wallet."
          actionLabel={permissions.canWrite ? 'Add account' : undefined}
          onAction={permissions.canWrite ? () => navigation.navigate('AddAccount', { walletId }) : undefined}
        />
      ) : (
        (accounts.data ?? []).map((account) => (
          <AccountRow key={account.id} account={account} onPress={() => navigation.navigate('AccountDetail', { accountId: account.id })} />
        ))
      )}

      {members.data !== undefined && members.data.length > 1 ? (
        <View>
          <Text variant="label" tone="muted" style={{ marginBottom: theme.spacing.sm }}>
            Members
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
            Wallet actions
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
              <Text tone="danger">Leave wallet</Text>
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
              <Text tone="danger">Archive wallet</Text>
            </Pressable>
          ) : null}
        </View>
      ) : null}

      <ConfirmDialog
        visible={pendingAction !== null}
        title={pendingAction === 'leave' ? 'Leave this wallet?' : 'Archive this wallet?'}
        message={
          pendingAction === 'leave'
            ? 'You will lose access until someone invites you back.'
            : 'This wallet and its accounts will be hidden, not deleted. No transaction history is lost.'
        }
        confirmLabel={pendingAction === 'leave' ? 'Leave' : 'Archive'}
        destructive
        onConfirm={() => void handleConfirmAction()}
        onCancel={() => setPendingAction(null)}
      />
    </ScrollView>
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
