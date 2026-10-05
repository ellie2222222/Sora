import { User as UserIcon } from 'lucide-react-native';
import { View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { Text } from '@/components';
import { useAuth, useTheme } from '@/app/providers';

export function ProfileHeader() {
  const theme = useTheme();
  const { t } = useTranslation();
  const { isGuest, user } = useAuth();

  const displayName = isGuest
    ? t('guest.settings.guestTitle')
    : user?.displayName || user?.email?.split('@')[0] || t('nav.account');
  const subtitle = isGuest ? t('guest.settings.guestSubtitle') : user?.email ?? '';
  const initial = displayName.charAt(0).toUpperCase();

  return (
    <View className="flex-row items-center gap-md">
      <View
        className="rounded-pill items-center justify-center"
        style={{
          width: theme.sizes.badge.md,
          height: theme.sizes.badge.md,
          backgroundColor: theme.colors.primaryMuted,
        }}
      >
        {isGuest ? (
          <UserIcon size={theme.iconSize.lg} color={theme.colors.primary} />
        ) : (
          <Text weight="bold" style={{ color: theme.colors.primary }}>
            {initial}
          </Text>
        )}
      </View>

      <View className="flex-1 gap-xxs">
        <Text weight="bold" style={{ fontSize: theme.fontSize.md }}>
          {displayName}
        </Text>

        <Text tone="muted" variant="caption" numberOfLines={1}>
          {subtitle}
        </Text>
      </View>
    </View>
  );
}

