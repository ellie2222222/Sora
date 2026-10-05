import { X } from 'lucide-react-native';
import { Pressable, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import type { WalletInvitationResponse } from '@sora/contracts';

import { Card, Text } from '@/components';
import { useTheme } from '@/app/providers';
import { getRoleLabel } from '@/utils';

export function InvitationRow({ invitation, onRevoke }: { invitation: WalletInvitationResponse; onRevoke: () => void }) {
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
          hitSlop={(theme.sizes.touchTarget - theme.iconSize.lg) / 2}
          accessibilityRole="button"
          accessibilityLabel={t('members.revokeInvitation')}
          accessibilityHint={invitation.invitedEmail}
          onPress={onRevoke}
        >
          <X size={theme.iconSize.lg} color={theme.colors.danger} />
        </Pressable>
      </View>
    </Card>
  );
}
