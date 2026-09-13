import { View, Pressable } from 'react-native';
import { WifiOff, RefreshCw, AlertCircle } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';

import { useTheme } from '../app/providers/ThemeProvider';
import { useNetworkStatus } from '../hooks/useNetworkStatus';
import { Text } from './Text';
import { AnimatedIcon } from './AnimatedIcon';
import { SlideUp } from './SlideUp';

export interface OfflineBannerProps {
  testID?: string;
}

/**
 * Non-blocking connection/sync status banner.
 * Displays connection availability or background sync status without breaking shell navigation.
 */
export function OfflineBanner({ testID = 'offline-banner' }: OfflineBannerProps) {
  const theme = useTheme();
  const { t } = useTranslation();
  const { isOnline, hasSyncError, isSyncing, retrySync } = useNetworkStatus();

  if (isOnline && !hasSyncError) {
    return null;
  }

  const isOfflineMode = !isOnline;

  return (
    <SlideUp distance={-12} duration={250}>
      <View
        testID={testID}
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          paddingHorizontal: theme.spacing.md,
          paddingVertical: theme.spacing.xs + 2,
          backgroundColor: isOfflineMode
            ? theme.colors.warningMuted ?? '#FFFBEB'
            : theme.colors.dangerMuted ?? '#FEF2F2',
          borderBottomWidth: 1,
          borderBottomColor: isOfflineMode
            ? theme.colors.warning ?? '#F59E0B'
            : theme.colors.danger ?? '#EF4444',
        }}
      >
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: theme.spacing.xs + 2, flex: 1 }}>
          {isOfflineMode ? (
            <WifiOff size={16} color={theme.colors.warning ?? '#D97706'} />
          ) : (
            <AlertCircle size={16} color={theme.colors.danger ?? '#DC2626'} />
          )}
          <Text
            variant="caption"
            style={{
              color: isOfflineMode
                ? theme.colors.warning ?? '#B45309'
                : theme.colors.danger ?? '#B91C1C',
              fontWeight: '600',
              flex: 1,
            }}
            numberOfLines={2}
          >
            {isOfflineMode
              ? t('errors.offlineMessage', 'No internet connection. Your local data is still available.')
              : t('errors.syncFailed', "Couldn't sync your changes")}
          </Text>
        </View>

        {hasSyncError && isOnline ? (
          <Pressable
            onPress={retrySync}
            disabled={isSyncing}
            style={({ pressed }) => ({
              flexDirection: 'row',
              alignItems: 'center',
              gap: 4,
              paddingHorizontal: theme.spacing.sm,
              paddingVertical: 4,
              borderRadius: theme.radius.sm,
              backgroundColor: theme.colors.surface,
              opacity: pressed || isSyncing ? 0.7 : 1,
            })}
          >
            <AnimatedIcon
              icon={RefreshCw}
              size={13}
              color={theme.colors.text}
              animation={isSyncing ? 'spin' : 'none'}
            />
            <Text variant="caption" style={{ fontWeight: '600', fontSize: 12 }}>
              {t('common.tryAgain', 'Try again')}
            </Text>
          </Pressable>
        ) : null}
      </View>
    </SlideUp>
  );
}
