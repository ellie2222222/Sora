import { MoreVertical, UsersRound, X, UserPlus } from 'lucide-react-native';
import { useState } from 'react';
import { Pressable, ScrollView, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { WalletRole, type WalletInvitationResponse, type WalletMemberResponse } from '@sora/contracts';

import { ActionSheet, Button, Card, ConfirmDialog, ListItemEnter, Skeleton, StateView, Text } from '@/components';
import type { ActionSheetAction } from '@/components';
import { useAuth, useTheme } from '@/app/providers';
import {
  useGetWalletQuery,
  useListInvitationsQuery,
  useListMembersQuery,
  useRemoveMemberMutation,
  useRevokeInvitationMutation,
  useTransferOwnershipMutation,
  useUpdateMemberRoleMutation,
} from '@/app/store';
import { canAdminister, getRoleLabel, isNetworkError, messageOf } from '@/utils';

export function WalletMembersPanel({ walletId, onInvite }: { walletId: string; onInvite: () => void }) {
  const theme = useTheme();
  const { t } = useTranslation();
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

  const isOwner = canAdminister(wallet.data?.role ?? null);

  async function handleConfirmTransfer() {
    if (transferTarget === null) return;
    setTransferError(null);
    try {
      await transferOwnership({ walletId, body: { toUserId: transferTarget.userId } }).unwrap();
      setTransferTarget(null);
    } catch (error) {
      setTransferError(messageOf(error, t));
    }
  }

  async function handleRoleChange(member: WalletMemberResponse, role: WalletRole) {
    setActionError(null);
    try {
      await updateMemberRole({ walletId, memberId: member.id, body: { role } }).unwrap();
    } catch (error) {
      setActionError(messageOf(error, t));
    }
  }

  /** Remove and revoke report a failure the same way a role change does, rather than failing silently. */
  async function runAction(action: () => Promise<unknown>) {
    setActionError(null);
    try {
      await action();
    } catch (error) {
      setActionError(messageOf(error, t));
    }
  }

  const memberActions: ActionSheetAction[] =
    actionTarget === null
      ? []
      : [
          ...(actionTarget.role !== WalletRole.EDITOR
            ? [{ label: t('members.setAsEditor'), onPress: () => void handleRoleChange(actionTarget, WalletRole.EDITOR) }]
            : []),
          ...(actionTarget.role !== WalletRole.VIEWER
            ? [{ label: t('members.setAsViewer'), onPress: () => void handleRoleChange(actionTarget, WalletRole.VIEWER) }]
            : []),
          {
            label: t('members.makeOwner'),
            onPress: () => {
              setTransferError(null);
              setTransferTarget(actionTarget);
            },
          },
          {
            label: t('members.removeFromWallet'),
            destructive: true,
            onPress: () => void runAction(() => removeMember({ walletId, memberId: actionTarget.id }).unwrap()),
          },
        ];

  const renderContent = () => {
    if (wallet.isLoading || members.isLoading) {
      return (
        <>
          {Array.from({ length: 4 }).map((_, i) => (
            <MemberItemSkeleton key={i} />
          ))}
        </>
      );
    }
    if (members.isError && !isNetworkError(members.error)) {
      return <StateView variant="error" error={members.error} retryAction={() => void members.refetch()} />;
    }

    return (
      <>
        {transferError !== null ? <Text tone="danger">{transferError}</Text> : null}
        {actionError !== null ? <Text tone="danger">{actionError}</Text> : null}

        {(members.data ?? []).map((member) => (
          <ListItemEnter key={member.id}>
            <MemberItem
              member={member}
              isSelf={member.userId === user?.id}
              canManage={isOwner}
              onOpenActions={() => {
                setActionError(null);
                setActionTarget(member);
              }}
            />
          </ListItemEnter>
        ))}

        {isOwner && invitations.data !== undefined && invitations.data.length > 0 ? (
          <View>
            <Text variant="label" tone="muted" style={{ marginBottom: theme.spacing.sm }}>
              {t('members.pendingInvitations')}
            </Text>
            {invitations.data.map((invitation) => (
              <ListItemEnter key={invitation.id}>
                <InvitationRow
                  invitation={invitation}
                  onRevoke={() => void runAction(() => revokeInvitation({ walletId, invitationId: invitation.id }).unwrap())}
                />
              </ListItemEnter>
            ))}
          </View>
        ) : null}
      </>
    );
  };

  return (
    <>
      <ScrollView
        testID="list-members"
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ gap: theme.spacing.md, paddingBottom: theme.spacing.md }}
      >
        {isOwner ? (
          <Button testID="btn-add-invitation" label={t('members.invite')} icon={UserPlus} size="sm" onPress={onInvite} style={{ alignSelf: 'flex-end' }} />
        ) : null}

        {renderContent()}
      </ScrollView>

      <ActionSheet
        visible={actionTarget !== null}
        title={actionTarget?.displayName}
        actions={memberActions}
        onCancel={() => setActionTarget(null)}
      />

      <ConfirmDialog
        visible={transferTarget !== null}
        title={t('members.transferTitle')}
        message={transferTarget !== null ? t('members.transferMessage', { name: transferTarget.displayName }) : undefined}
        confirmLabel={t('members.transfer')}
        destructive
        onConfirm={() => void handleConfirmTransfer()}
        onCancel={() => setTransferTarget(null)}
      />
    </>
  );
}

function MemberItem({
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
  const { t } = useTranslation();
  const canAct = canManage && !isSelf && member.role !== WalletRole.OWNER;

  return (
    <Card testID={`row-member-${member.id}`}>
      <View className="flex-row justify-between items-center">
        <View className="flex-row items-center" style={{ gap: theme.spacing.sm }}>
          <UsersRound size={18} color={theme.colors.textMuted} />
          <View>
            <Text weight="semibold">
              {member.displayName}
              {isSelf ? t('members.you') : ''}
            </Text>
            <Text variant="caption" tone="muted">
              {member.relationLabel !== null ? `${member.relationLabel} · ` : ''}
              {getRoleLabel(member.role, t)}
            </Text>
          </View>
        </View>
        {canAct ? (
          <Pressable
            testID={`btn-actions-member-${member.id}`}
            hitSlop={13}
            accessibilityRole="button"
            accessibilityLabel={t('members.memberActions', { name: member.displayName })}
            onPress={onOpenActions}
          >
            <MoreVertical size={18} color={theme.colors.textMuted} />
          </Pressable>
        ) : null}
      </View>
    </Card>
  );
}

function InvitationRow({ invitation, onRevoke }: { invitation: WalletInvitationResponse; onRevoke: () => void }) {
  const theme = useTheme();
  const { t } = useTranslation();

  return (
    <Card testID={`row-invitation-${invitation.id}`}>
      <View className="flex-row justify-between items-center">
        <View>
          <Text>{invitation.invitedEmail}</Text>
          <Text variant="caption" tone="muted">
            {invitation.relationLabel !== null ? `${invitation.relationLabel} · ` : ''}
            {getRoleLabel(invitation.role, t)} · {t('members.expires', { date: invitation.expiresAt.slice(0, 10) })}
          </Text>
        </View>
        <Pressable
          testID={`btn-revoke-invitation-${invitation.id}`}
          hitSlop={13}
          accessibilityRole="button"
          accessibilityLabel={t('members.revokeInvitation')}
          accessibilityHint={invitation.invitedEmail}
          onPress={onRevoke}
        >
          <X size={18} color={theme.colors.danger} />
        </Pressable>
      </View>
    </Card>
  );
}

function MemberItemSkeleton() {
  const theme = useTheme();

  return (
    <Card>
      <View className="flex-row justify-between items-center">
        <View className="flex-row items-center" style={{ gap: theme.spacing.sm }}>
          <Skeleton width={18} height={18} radius={9} />
          <View style={{ gap: theme.spacing.xs }}>
            <Skeleton width={120} height={16} radius={6} />
            <Skeleton width={80} height={14} radius={6} />
          </View>
        </View>
        <Skeleton width={18} height={18} radius={9} />
      </View>
    </Card>
  );
}
