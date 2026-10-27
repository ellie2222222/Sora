import { useState } from 'react';
import { Mail, MailCheck } from 'lucide-react-native';
import { View } from 'react-native';
import { useTranslation } from 'react-i18next';
import type { ReceivedInvitationResponse } from '@sora/contracts';

import { Button, MutationConfirmDialog, Skeleton, StateView, Text, ThemedIcon } from '@/components';
import { useAuth, useTheme, useToast } from '@/app/providers';
import {
  useAcceptReceivedInvitationMutation,
  useDeclineReceivedInvitationMutation,
  useListReceivedInvitationsQuery,
} from '@/app/store';
import { dayOfDate, formatDay, getRoleLabel, messageOf } from '@/utils';
import { CollapsibleSection, SettingsDivider } from './CollapsibleSection';
import { VerifyEmailSheet } from './VerifyEmailSheet';

/** Invitations sent to the signed-in user's own email, answered here without the link (WAL-US-14). */
export function InvitationsSection({ isOpen, onToggle }: { isOpen: boolean; onToggle: () => void }) {
  const theme = useTheme();
  const { t } = useTranslation();
  const { user } = useAuth();
  // The server refuses the inbox to an unverified email, so don't ask it.
  const verified = user?.emailVerified === true;
  const invitations = useListReceivedInvitationsQuery(undefined, { skip: !verified });
  const [declining, setDeclining] = useState<ReceivedInvitationResponse | null>(null);
  const [verifying, setVerifying] = useState(false);
  const [decline] = useDeclineReceivedInvitationMutation();
  const { showToast } = useToast();

  const count = invitations.data?.length ?? 0;
  const subtitle = !verified
    ? t('settings.invitations.useLinkSubtitle')
    : invitations.data === undefined
      ? undefined
      : count > 0
        ? t('settings.invitations.waiting', { count })
        : t('settings.invitations.noneWaiting');

  return (
    <CollapsibleSection
      testID="settings-nav-invitations"
      icon={<ThemedIcon icon={Mail} size={theme.iconSize.lg} color={count > 0 ? theme.colors.primary : theme.colors.textMuted} />}
      title={t('settings.invitations.title')}
      subtitle={subtitle}
      isOpen={isOpen}
      onToggle={onToggle}
    >
      {!verified ? (
        <View style={{ gap: theme.spacing.md }} testID="invitations-unverified">
          <Text variant="caption" tone="muted" style={{ lineHeight: theme.lineHeight.sm }}>
            {t('settings.invitations.unverifiedBody')}
          </Text>
          <Button
            testID="btn-open-email-verification"
            variant="secondary"
            label={t('settings.invitations.verifyEmail')}
            icon={MailCheck}
            onPress={() => setVerifying(true)}
            fullWidth
          />
        </View>
      ) : invitations.isError && invitations.data === undefined ? (
        <StateView
          variant="error"
          error={invitations.error}
          retryAction={() => void invitations.refetch()}
          testID="invitations-error"
          entrance="none"
        />
      ) : invitations.data === undefined ? (
        <View style={{ gap: theme.spacing.sm }} testID="invitations-loading">
          {[0, 1].map((key) => (
            <Skeleton key={key} height={theme.sizes.listRowMinHeight} radius={theme.radius.md} />
          ))}
        </View>
      ) : invitations.data.length === 0 ? (
        <View style={{ gap: theme.spacing.xxs }} testID="invitations-empty">
          <Text weight="semibold" style={{ fontSize: theme.fontSize.sm }}>
            {t('settings.invitations.emptyTitle')}
          </Text>
          <Text variant="caption" tone="muted" style={{ lineHeight: theme.lineHeight.sm }}>
            {t('settings.invitations.emptyBody')}
          </Text>
        </View>
      ) : (
        <View testID="list-received-invitations">
          {invitations.data.map((invitation, index) => (
            <View key={invitation.id}>
              {index > 0 ? <SettingsDivider /> : null}
              <ReceivedInvitationRow invitation={invitation} onDecline={() => setDeclining(invitation)} />
            </View>
          ))}
        </View>
      )}

      <VerifyEmailSheet visible={verifying} onClose={() => setVerifying(false)} />

      <MutationConfirmDialog
        visible={declining !== null}
        title={t('settings.invitations.declineTitle', { wallet: declining?.walletName ?? '' })}
        message={t('settings.invitations.declineBody', { name: declining?.inviterName ?? '' })}
        confirmLabel={t('settings.invitations.decline')}
        run={() => decline(declining!.id).unwrap()}
        onCancel={() => setDeclining(null)}
        onDone={() => {
          showToast(t('settings.invitations.declined', { wallet: declining?.walletName ?? '' }), 'info');
          setDeclining(null);
        }}
        onError={(message) => {
          setDeclining(null);
          showToast(message, 'error');
        }}
      />
    </CollapsibleSection>
  );
}

function ReceivedInvitationRow({ invitation, onDecline }: { invitation: ReceivedInvitationResponse; onDecline: () => void }) {
  const theme = useTheme();
  const { t } = useTranslation();
  const { showToast } = useToast();
  const [accept, { isLoading: accepting }] = useAcceptReceivedInvitationMutation();

  const handleAccept = async () => {
    try {
      await accept(invitation.id).unwrap();
      showToast(t('settings.invitations.joined', { wallet: invitation.walletName }), 'success');
    } catch (error) {
      showToast(messageOf(error, t), 'error');
    }
  };

  return (
    <View style={{ gap: theme.spacing.sm, paddingVertical: theme.spacing.sm }} testID={`row-received-invitation-${invitation.id}`}>
      <View style={{ gap: theme.spacing.xxs }}>
        <Text weight="semibold">{invitation.walletName}</Text>
        <Text variant="caption" tone="muted" style={{ lineHeight: theme.lineHeight.sm }}>
          {t('settings.invitations.invitedBy', { name: invitation.inviterName, role: getRoleLabel(invitation.role, t) })}
        </Text>
        <Text variant="caption" tone="muted" style={{ lineHeight: theme.lineHeight.sm }}>
          {t('members.expires', { date: formatDay(dayOfDate(new Date(invitation.expiresAt))) })}
        </Text>
      </View>
      <View className="flex-row" style={{ gap: theme.spacing.sm }}>
        <View style={{ flex: 1 }}>
          <Button
            testID={`btn-decline-invitation-${invitation.id}`}
            label={t('settings.invitations.decline')}
            variant="danger-outline"
            size="sm"
            disabled={accepting}
            onPress={onDecline}
            fullWidth
          />
        </View>
        <View style={{ flex: 1 }}>
          <Button
            testID={`btn-accept-invitation-${invitation.id}`}
            label={t('settings.invitations.accept')}
            variant="primary"
            size="sm"
            loading={accepting}
            onPress={() => void handleAccept()}
            fullWidth
          />
        </View>
      </View>
    </View>
  );
}
