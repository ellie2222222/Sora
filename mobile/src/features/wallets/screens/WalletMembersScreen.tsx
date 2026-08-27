import { UsersRound, X } from 'lucide-react-native';
import { Pressable, ScrollView, View } from 'react-native';
import type { WalletInvitationResponse, WalletMemberResponse } from '@sora/contracts';

import { Button, Card, ErrorState, Text } from '../../../components/index.ts';
import { SkeletonList } from '../../../components/Skeleton.tsx';
import { useTheme } from '../../../app/providers/ThemeProvider.tsx';
import { useAuth } from '../../../app/providers/AuthProvider.tsx';
import { useWalletDetail } from '../hooks/useWallets.ts';
import {
  useRemoveMember,
  useRevokeInvitation,
  useWalletInvitations,
  useWalletMembers,
} from '../hooks/useWalletMembers.ts';
import { canAdminister, ROLE_LABELS } from '../../../utils/roles.ts';
import type { AppStackScreenProps } from '../../../app/navigation/types.ts';

export function WalletMembersScreen({ route, navigation }: AppStackScreenProps<'WalletMembers'>) {
  const theme = useTheme();
  const { walletId } = route.params;
  const { user } = useAuth();

  const wallet = useWalletDetail(walletId);
  const members = useWalletMembers(walletId);
  const invitations = useWalletInvitations(walletId);
  const removeMember = useRemoveMember(walletId);
  const revokeInvitation = useRevokeInvitation(walletId);

  if (wallet.isLoading || members.isLoading) return <SkeletonList rows={4} />;
  if (members.isError) return <ErrorState error={members.error} onRetry={() => void members.refetch()} />;

  const isOwner = canAdminister(wallet.data?.role ?? null);

  return (
    <ScrollView contentContainerStyle={{ padding: theme.spacing.md, gap: theme.spacing.md }}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
        <Text variant="title">Members</Text>
        {isOwner ? (
          <Button
            testID="wallet-members-invite"
            label="Invite"
            size="sm"
            onPress={() => navigation.navigate('InviteMember', { walletId })}
          />
        ) : null}
      </View>

      {(members.data ?? []).map((member) => (
        <MemberRow
          key={member.id}
          member={member}
          isSelf={member.userId === user?.id}
          canManage={isOwner}
          onRemove={() => removeMember.mutate(member.id)}
        />
      ))}

      {isOwner && invitations.data !== undefined && invitations.data.length > 0 ? (
        <View>
          <Text variant="label" tone="muted" style={{ marginBottom: theme.spacing.sm }}>
            Pending invitations
          </Text>
          {invitations.data.map((invitation) => (
            <InvitationRow
              key={invitation.id}
              invitation={invitation}
              onRevoke={() => revokeInvitation.mutate(invitation.id)}
            />
          ))}
        </View>
      ) : null}
    </ScrollView>
  );
}

function MemberRow({
  member,
  isSelf,
  canManage,
  onRemove,
}: {
  member: WalletMemberResponse;
  isSelf: boolean;
  canManage: boolean;
  onRemove: () => void;
}) {
  const theme = useTheme();

  return (
    <Card testID={`wallet-member-${member.id}`}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: theme.spacing.sm }}>
          <UsersRound size={18} color={theme.colors.textMuted} />
          <View>
            <Text weight="semibold">
              {member.displayName}
              {isSelf ? ' (you)' : ''}
            </Text>
            <Text variant="caption" tone="muted">
              {member.relationLabel !== null ? `${member.relationLabel} · ` : ''}
              {ROLE_LABELS[member.role]}
            </Text>
          </View>
        </View>
        {canManage && !isSelf && member.role !== 'OWNER' ? (
          <Pressable testID={`wallet-member-remove-${member.id}`} onPress={onRemove}>
            <X size={18} color={theme.colors.danger} />
          </Pressable>
        ) : null}
      </View>
    </Card>
  );
}

function InvitationRow({
  invitation,
  onRevoke,
}: {
  invitation: WalletInvitationResponse;
  onRevoke: () => void;
}) {
  const theme = useTheme();

  return (
    <Card testID={`wallet-invitation-${invitation.id}`}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
        <View>
          <Text>{invitation.invitedEmail}</Text>
          <Text variant="caption" tone="muted">
            {invitation.relationLabel !== null ? `${invitation.relationLabel} · ` : ''}
            {ROLE_LABELS[invitation.role]} · expires {invitation.expiresAt.slice(0, 10)}
          </Text>
        </View>
        <Pressable testID={`wallet-invitation-revoke-${invitation.id}`} onPress={onRevoke}>
          <X size={18} color={theme.colors.danger} />
        </Pressable>
      </View>
    </Card>
  );
}
