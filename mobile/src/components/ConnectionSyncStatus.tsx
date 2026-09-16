import { useState } from 'react';
import { Pressable, View } from 'react-native';
import { useSelector } from 'react-redux';
import { Check, Clock, RefreshCw, TriangleAlert, Wifi, WifiOff } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';

import { useAuth, useTheme } from '@/app/providers';
import { selectPendingCount, selectSyncStatus } from '@/app/store';
import { useNetworkStatus } from '../hooks/useNetworkStatus';
import { AnimatedIcon } from './AnimatedIcon';
import { BottomSheetModal } from './BottomSheetModal';
import { Button } from './Button.tsx';
import { Text } from './Text';

type OpenSheet = 'connection' | 'sync' | null;

/**
 * Wallet-header connection/sync indicator — two small icons, informational
 * only. Never blocks reading or writing: every screen stays usable offline
 * via the queue/cache in `services/sync/`, so a tap opens a lightweight
 * sheet rather than a banner, toast, or error screen.
 */
export function ConnectionSyncStatus({ testID = 'connection-sync-status' }: { testID?: string }) {
  const theme = useTheme();
  const { t } = useTranslation();
  const { isOnline, isSyncing: retryInFlight, retrySync } = useNetworkStatus();
  const { isGuest } = useAuth();
  const syncStatus = useSelector(selectSyncStatus);
  const pendingCount = useSelector(selectPendingCount);
  const [openSheet, setOpenSheet] = useState<OpenSheet>(null);

  const syncing = syncStatus === 'syncing' || retryInFlight;

  // Guest mode never has a backend session to sync to — the offline queue
  // stays permanently empty (guest writes bypass it entirely), so
  // `syncStatus` would otherwise read as 'synced' regardless of `isOnline`.
  // Claiming "connected / synced to the cloud" there would be false: device
  // network reachability (NetInfo, via `isOnline`) is not the same fact as
  // "there is a backend this data is backed up to."
  const connectionLabel = isGuest ? t('guest.settings.guestTitle') : t(isOnline ? 'errors.connectionOnline' : 'errors.connectionOffline');
  const connectionDetail = isGuest
    ? t('guest.settings.guestSubtitle')
    : t(isOnline ? 'errors.connectionOnlineDetail' : 'errors.connectionOfflineDetail');

  const syncLabel = isGuest
    ? t('guest.settings.guestTitle')
    : t(
        syncing
          ? 'errors.syncStatusSyncing'
          : syncStatus === 'failed'
            ? 'errors.syncStatusFailed'
            : syncStatus === 'pending'
              ? 'errors.syncStatusPending'
              : 'errors.syncStatusSynced',
      );
  const syncDetail = isGuest
    ? t('guest.settings.guestSubtitle')
    : t(
        syncing
          ? 'errors.syncDetailSyncing'
          : syncStatus === 'failed'
            ? 'errors.syncDetailFailed'
            : syncStatus === 'pending'
              ? 'errors.syncDetailPending'
              : 'errors.syncDetailSynced',
        { count: pendingCount },
      );

  const syncIconColor = syncing
    ? theme.colors.primary
    : syncStatus === 'failed'
      ? theme.colors.danger
      : syncStatus === 'pending'
        ? theme.colors.textFaint
        : theme.colors.success;

  const canRetry = !isGuest && isOnline && (syncStatus === 'pending' || syncStatus === 'failed');

  return (
    <View className="flex-row items-center" style={{ gap: theme.spacing.sm }} testID={testID}>
      <Pressable
        testID={`${testID}-connection`}
        accessibilityRole="button"
        accessibilityLabel={connectionLabel}
        onPress={() => setOpenSheet('connection')}
        hitSlop={8}
      >
        {isOnline ? (
          <Wifi size={16} color={theme.colors.textMuted} />
        ) : (
          <WifiOff size={16} color={theme.colors.warning} />
        )}
      </Pressable>

      <Pressable
        testID={`${testID}-sync`}
        accessibilityRole="button"
        accessibilityLabel={syncLabel}
        onPress={() => setOpenSheet('sync')}
        hitSlop={8}
      >
        {syncing ? (
          <AnimatedIcon icon={RefreshCw} size={16} color={syncIconColor} animation="spin" />
        ) : syncStatus === 'failed' ? (
          <TriangleAlert size={16} color={syncIconColor} />
        ) : syncStatus === 'pending' ? (
          <Clock size={16} color={syncIconColor} />
        ) : (
          <Check size={16} color={syncIconColor} />
        )}
      </Pressable>

      <BottomSheetModal
        visible={openSheet === 'connection'}
        onClose={() => setOpenSheet(null)}
        title={connectionLabel}
        testID={`${testID}-connection-sheet`}
      >
        <Text variant="body" tone="muted" style={{ marginBottom: theme.spacing.md }}>
          {connectionDetail}
        </Text>
      </BottomSheetModal>

      <BottomSheetModal
        visible={openSheet === 'sync'}
        onClose={() => setOpenSheet(null)}
        title={syncLabel}
        testID={`${testID}-sync-sheet`}
      >
        <Text variant="body" tone="muted" style={{ marginBottom: theme.spacing.md }}>
          {syncDetail}
        </Text>
        {canRetry ? (
          <Button
            testID={`${testID}-sync-now`}
            label={t('errors.syncNowAction')}
            variant="secondary"
            size="sm"
            loading={retryInFlight}
            onPress={() => {
              void retrySync();
            }}
          />
        ) : null}
      </BottomSheetModal>
    </View>
  );
}
