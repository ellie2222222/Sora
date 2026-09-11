import { MoreVertical, UsersRound, X } from 'lucide-react-native';
import { useState } from 'react';
import { Pressable, ScrollView, View } from 'react-native';
import type { WalletInvitationResponse, WalletMemberResponse, WalletRole } from '@sora/contracts';

import { ActionSheet, Button, Card, ConfirmDialog, ErrorState, Text } from '../../../components/index.ts';
import type { ActionSheetAction } from '../../../components/ActionSheet.tsx';
import { SkeletonList } from '../../../components/Skeleton.tsx';
import { useTheme } from '../../../app/providers/ThemeProvider.tsx';
import { useAuth } from '../../../app/providers/AuthProvider.tsx';
import {
  useListMembersQuery,
  useRemoveMemberMutation,
  useTransferOwnershipMutation,
  useUpdateMemberRoleMutation,
} from '../../../app/store/api/membersApi.ts';
import { useListInvitationsQuery, useRevokeInvitationMutation } from '../../../app/store/api/invitationsApi.ts';
import { useGetWalletQuery } from '../../../app/store/api/walletsApi.ts';
import { messageOf } from '../../../utils/errors.ts';
import { canAdminister, ROLE_LABELS } from '../../../utils/roles.ts';
import type { AppStackScreenProps } from '../../../app/navigation/types.ts';

export function WalletMembersScreen({ route, navigation }: AppStackScreenProps<'WalletMembers'>) {
  const theme = useTheme();
  const { walletId } = route.params;
  const { user } = useAuth();

  const wallet = useGetWalletQuery(walletId);
  const members = useListMembersQuery({ walletId });
  const invitations = useListInvitationsQuery({ walletId });
  const [removeMember] = useRemoveMemberMutation();
  const [revokeInvitation] = useRevokeInvitationMutation();
  const [transferOwnership] = useTransferOwnershipMutation();
  const [updateMemberRole] = useUpdateMemberRoleMutation();

  const [transferTarget, setTransferTarget] = useState<WalletMemberResponse | null>(null);
  const [transferError, setTransferError] = useState<string | null>(null);
  const [actionTarget, setActionTarget] = useState<WalletMemberResponse | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  if (wallet.isLoading || members.isLoading) return <SkeletonList rows={4} />;
  if (members.isError) return <ErrorState error={members.error} onRetry={() => void members.refetch()} />;

  const isOwner = canAdminister(wallet.data?.role ?? null);

  async function handleConfirmTransfer() {
    if (transferTarget === null) return;
    setTransferError(null);
    try {
      await transferOwnership({ walletId, body: { toUserId: transferTarget.userId } }).unwrap();
      setTransferTarget(null);
    } catch (error) {
      setTransferError(messageOf(error));
    }
  }

  async function handleRoleChange(member: WalletMemberResponse, role: WalletRole) {
    setActionError(null);
    try {
      await updateMemberRole({ walletId, memberId: member.id, body: { role } }).unwrap();
    } catch (error) {
      setActionError(messageOf(error));
    }
  }

  const memberActions: ActionSheetAction[] =
    actionTarget === null
      ? []
      : [
          ...(actionTarget.role !== 'EDITOR'
            ? [{ label: 'Set as Editor', onPress: () => void handleRoleChange(actionTarget, 'EDITOR') }]
            : []),
          ...(actionTarget.role !== 'VIEWER'
            ? [{ label: 'Set as Viewer', onPress: () => void handleRoleChange(actionTarget, 'VIEWER') }]
            : []),
          {
            label: 'Make owner',
            onPress: () => {
              setTransferError(null);
              setTransferTarget(actionTarget);
            },
          },
          {
            label: 'Remove from wallet',
            destructive: true,
            onPress: () => void removeMember({ walletId, memberId: actionTarget.id }),
          },
        ];

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

      {transferError !== null ? <Text tone="danger">{transferError}</Text> : null}
      {actionError !== null ? <Text tone="danger">{actionError}</Text> : null}

      {(members.data ?? []).map((member) => (
        <MemberRow
          key={member.id}
          member={member}
          isSelf={member.userId === user?.id}
          canManage={isOwner}
          onOpenActions={() => {
            setActionError(null);
            setActionTarget(member);
          }}
        />
      ))}

      <ActionSheet
        visible={actionTarget !== null}
        title={actionTarget?.displayName}
        actions={memberActions}
        onCancel={() => setActionTarget(null)}
      />

      <ConfirmDialog
        visible={transferTarget !== null}
        title="Transfer ownership?"
        message={
          transferTarget !== null
            ? `${transferTarget.displayName} becomes the owner of this wallet. You become an Editor.`
            : undefined
        }
        confirmLabel="Transfer"
        destructive
        onConfirm={() => void handleConfirmTransfer()}
        onCancel={() => setTransferTarget(null)}
      />

      {isOwner && invitations.data !== undefined && invitations.data.length > 0 ? (
        <View>
          <Text variant="label" tone="muted" style={{ marginBottom: theme.spacing.sm }}>
            Pending invitations
          </Text>
          {invitations.data.map((invitation) => (
            <InvitationRow
              key={invitation.id}
              invitation={invitation}
              onRevoke={() => void revokeInvitation({ walletId, invitationId: invitation.id })}
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
  onOpenActions,
}: {
  member: WalletMemberResponse;
  isSelf: boolean;
  canManage: boolean;
  onOpenActions: () => void;
}) {
  const theme = useTheme();
  const canAct = canManage && !isSelf && member.role !== 'OWNER';

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
        {canAct ? (
          <Pressable testID={`wallet-member-actions-${member.id}`} onPress={onOpenActions}>
            <MoreVertical size={18} color={theme.colors.textMuted} />
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
