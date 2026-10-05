import { MoreVertical, UsersRound } from 'lucide-react-native';
import { Pressable, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import type { WalletMemberResponse } from '@sora/contracts';

import { Card, Text } from '@/components';
import { useTheme } from '@/app/providers';
import { getRoleLabel } from '@/utils';

export function MemberItem({
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
          <UsersRound size={theme.iconSize.lg} color={theme.colors.textMuted} />
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
            hitSlop={(theme.sizes.touchTarget - theme.iconSize.lg) / 2}
            accessibilityRole="button"
            accessibilityLabel={t('members.memberActions', { name: member.displayName })}
            onPress={onOpenActions}
          >
            <MoreVertical size={theme.iconSize.lg} color={theme.colors.textMuted} />
          </Pressable>
        ) : null}
      </View>
    </Card>
  );
}
