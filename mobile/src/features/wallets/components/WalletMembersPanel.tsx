import { MoreVertical, Pencil, UserMinus, UsersRound, X, UserPlus } from 'lucide-react-native';
import { useState } from 'react';
import { Pressable, ScrollView, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { WalletRole, type WalletInvitationResponse, type WalletMemberResponse } from '@sora/contracts';

import { ActionSheet, Button, Card, closeOpenSwipeRow, ConfirmDialog, ListItemEnter, Skeleton, StateView, SwipeableRow, Text } from '@/components';
import type { ActionSheetAction, SwipeRowAction } from '@/components';
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
import { canAdminister, canManageMember, getRoleLabel, isNetworkError, messageOf } from '@/utils';

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
  const [removeTarget, setRemoveTarget] = useState<WalletMemberResponse | null>(null);
  const [revokeTarget, setRevokeTarget] = useState<WalletInvitationResponse | null>(null);

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

  const sheetActions: ActionSheetAction[] =
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
            onPress: () => setRemoveTarget(actionTarget),
          },
        ];
  // ActionSheet leaves closing to its caller: the chosen action runs and the sheet goes away.
  const memberActions = sheetActions.map((action) => ({
    ...action,
    onPress: () => {
      setActionTarget(null);
      action.onPress();
    },
  }));

  const openMemberActions = (member: WalletMemberResponse) => {
    setActionError(null);
    setActionTarget(member);
  };

  const canActOn = (member: WalletMemberResponse) => canManageMember(wallet.data?.role ?? null, member, user?.id);
  const memberSwipeActions = (member: WalletMemberResponse): SwipeRowAction[] =>
    canActOn(member)
      ? [
          { key: 'edit', label: t('common.edit'), icon: Pencil, tone: 'primary', onPress: () => openMemberActions(member), testID: 'btn-edit-member' },
          { key: 'remove', label: t('common.remove'), icon: UserMinus, tone: 'danger', onPress: () => setRemoveTarget(member), testID: 'btn-remove-member' },
        ]
      : [];

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
            <SwipeableRow actions={memberSwipeActions(member)} radius={theme.radius.lg}>
              <MemberItem
                member={member}
                isSelf={member.userId === user?.id}
                canAct={canActOn(member)}
                onOpenActions={() => openMemberActions(member)}
              />
            </SwipeableRow>
          </ListItemEnter>
        ))}

        {isOwner && invitations.data !== undefined && invitations.data.length > 0 ? (
          <View>
            <Text variant="label" tone="muted" style={{ marginBottom: theme.spacing.sm }}>
              {t('members.pendingInvitations')}
            </Text>
            {invitations.data.map((invitation) => (
              <ListItemEnter key={invitation.id}>
                <SwipeableRow
                  radius={theme.radius.lg}
                  actions={[
                    { key: 'revoke', label: t('common.revoke'), icon: X, tone: 'danger', onPress: () => setRevokeTarget(invitation), testID: 'btn-revoke-invitation' },
                  ]}
                >
                  <InvitationRow invitation={invitation} onRevoke={() => setRevokeTarget(invitation)} />
                </SwipeableRow>
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
        onScrollBeginDrag={closeOpenSwipeRow}
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

      <ConfirmDialog
        visible={removeTarget !== null}
        title={t('members.removeTitle')}
        message={removeTarget !== null ? t('members.removeMessage', { name: removeTarget.displayName }) : undefined}
        confirmLabel={t('common.remove')}
        destructive
        onConfirm={() => {
          const target = removeTarget;
          setRemoveTarget(null);
          if (target !== null) void runAction(() => removeMember({ walletId, memberId: target.id }).unwrap());
        }}
        onCancel={() => setRemoveTarget(null)}
      />

      <ConfirmDialog
        visible={revokeTarget !== null}
        title={t('members.revokeTitle')}
        message={revokeTarget !== null ? t('members.revokeMessage', { email: revokeTarget.invitedEmail }) : undefined}
        confirmLabel={t('common.revoke')}
        destructive
        onConfirm={() => {
          const target = revokeTarget;
          setRevokeTarget(null);
          if (target !== null) void runAction(() => revokeInvitation({ walletId, invitationId: target.id }).unwrap());
        }}
        onCancel={() => setRevokeTarget(null)}
      />
    </>
  );
}

function MemberItem({
  member,
  isSelf,
  canAct,
  onOpenActions,
}: {
  member: WalletMemberResponse;
  isSelf: boolean;
  canAct: boolean;
  onOpenActions: () => void;
}) {
  const theme = useTheme();
  const { t } = useTranslation();

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
