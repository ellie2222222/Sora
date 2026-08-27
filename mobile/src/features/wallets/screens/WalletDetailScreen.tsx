import { Landmark, Plus, Settings, UsersRound } from 'lucide-react-native';
import { Pressable, ScrollView, View } from 'react-native';
import type { AccountResponse } from '@sora/contracts';

import { Card, EmptyState, ErrorState, Money, Text } from '../../../components/index.ts';
import { SkeletonList } from '../../../components/Skeleton.tsx';
import { useTheme } from '../../../app/providers/ThemeProvider.tsx';
import { useAccounts } from '../../accounts/hooks/useAccounts.ts';
import { permissionsFor, ROLE_LABELS } from '../../../utils/roles.ts';
import { useWalletDetail } from '../hooks/useWallets.ts';
import { useWalletMembers } from '../hooks/useWalletMembers.ts';
import type { AppStackScreenProps } from '../../../app/navigation/types.ts';

export function WalletDetailScreen({ route, navigation }: AppStackScreenProps<'WalletDetail'>) {
  const theme = useTheme();
  const { walletId } = route.params;

  const wallet = useWalletDetail(walletId);
  const accounts = useAccounts({ walletId, status: 'ACTIVE' });
  const members = useWalletMembers(walletId);

  if (wallet.isLoading || accounts.isLoading) return <SkeletonList rows={5} />;
  if (wallet.isError) return <ErrorState error={wallet.error} onRetry={() => void wallet.refetch()} />;

  const data = wallet.data;
  if (data === undefined) return null;

  const permissions = permissionsFor(data.role);

  return (
    <ScrollView contentContainerStyle={{ padding: theme.spacing.md, gap: theme.spacing.md }}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
        <Text variant="heading">{data.isOwn ? data.name : data.relationLabel ?? data.name}</Text>
        {permissions.canAdminister ? (
          <Pressable testID="wallet-detail-settings" onPress={() => navigation.navigate('WalletMembers', { walletId })}>
            <Settings size={22} color={theme.colors.textMuted} />
          </Pressable>
        ) : null}
      </View>

      <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
        {data.balances.map((total) => (
          <Money key={total.currency} amount={total.amount} currency={total.currency} variant="heading" />
        ))}
        <Pressable
          testID="wallet-detail-members"
          onPress={() => navigation.navigate('WalletMembers', { walletId })}
          style={{ flexDirection: 'row', alignItems: 'center', gap: theme.spacing.xs }}
        >
          <UsersRound size={16} color={theme.colors.textMuted} />
          <Text tone="muted">{data.memberCount}</Text>
        </Pressable>
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
