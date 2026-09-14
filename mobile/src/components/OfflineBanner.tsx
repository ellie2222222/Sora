import { View, Pressable } from 'react-native';
import { useSelector } from 'react-redux';
import { WifiOff, RefreshCw, AlertCircle, RotateCw } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';

import { useTheme } from '../app/providers/ThemeProvider';
import { selectPendingCount } from '../app/store/offlineQueueSlice.ts';
import { useNetworkStatus } from '../hooks/useNetworkStatus';
import { Text } from './Text';
import { AnimatedIcon } from './AnimatedIcon';
import { SlideUp } from './SlideUp';

export interface OfflineBannerProps {
  testID?: string;
}

type BannerMode = 'offline' | 'syncError' | 'waiting';

/**
 * Non-blocking connection/sync status banner.
 * Displays connection availability or background sync status without breaking shell navigation.
 */
export function OfflineBanner({ testID = 'offline-banner' }: OfflineBannerProps) {
  const theme = useTheme();
  const { t } = useTranslation();
  const { isOnline, hasSyncError, isSyncing, retrySync } = useNetworkStatus();
  const pendingCount = useSelector(selectPendingCount);

  if (isOnline && !hasSyncError && pendingCount === 0) {
    return null;
  }

  // Precedence: a genuinely offline device says so, rather than "waiting to
  // sync" (which implies imminent connectivity); a sync error while online
  // outranks a merely-pending queue.
  const mode: BannerMode = !isOnline ? 'offline' : hasSyncError ? 'syncError' : 'waiting';

  const palette = {
    offline: {
      background: theme.colors.warningMuted ?? '#FFFBEB',
      border: theme.colors.warning ?? '#F59E0B',
      text: theme.colors.warning ?? '#B45309',
      icon: <WifiOff size={16} color={theme.colors.warning ?? '#D97706'} />,
    },
    syncError: {
      background: theme.colors.dangerMuted ?? '#FEF2F2',
      border: theme.colors.danger ?? '#EF4444',
      text: theme.colors.danger ?? '#B91C1C',
      icon: <AlertCircle size={16} color={theme.colors.danger ?? '#DC2626'} />,
    },
    waiting: {
      background: theme.colors.primaryMuted,
      border: theme.colors.primary,
      text: theme.colors.primary,
      icon: <RotateCw size={16} color={theme.colors.primary} />,
    },
  }[mode];

  const message =
    mode === 'offline'
      ? t('errors.offlineMessage', 'No internet connection. Your local data is still available.')
      : mode === 'syncError'
        ? t('errors.syncFailed', "Couldn't sync your changes")
        : t('errors.waitingToSync', { count: pendingCount, defaultValue: 'Waiting to sync ({{count}})' });

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
          backgroundColor: palette.background,
          borderBottomWidth: 1,
          borderBottomColor: palette.border,
        }}
      >
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: theme.spacing.xs + 2, flex: 1 }}>
          {palette.icon}
          <Text
            variant="caption"
            style={{
              color: palette.text,
              fontWeight: '600',
              flex: 1,
            }}
            numberOfLines={2}
          >
            {message}
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
