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
        className="w-[48px] h-[48px] rounded-pill items-center justify-center"
        style={{ backgroundColor: theme.colors.primaryMuted }}
      >
        {isGuest ? (
          <UserIcon size={24} color={theme.colors.primary} />
        ) : (
          <Text weight="bold" style={{ fontSize: 20, color: theme.colors.primary }}>
            {initial}
          </Text>
        )}
      </View>

      <View className="flex-1 gap-xxs">
        <View className="flex-row items-center gap-xs">
          <Text weight="bold" style={{ fontSize: 16 }}>
            {displayName}
          </Text>
          {!isGuest ? (
            <View
              className="px-sm py-xxs rounded-pill"
              style={{ backgroundColor: theme.colors.primaryMuted }}
            >
              <Text style={{ fontSize: 10, color: theme.colors.primary }} weight="semibold">
                {t('settings.activeAccount')}
              </Text>
            </View>
          ) : null}
        </View>

        <Text tone="muted" variant="caption" numberOfLines={1}>
          {subtitle}
        </Text>
      </View>
    </View>
  );
}

