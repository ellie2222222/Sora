import { useState } from 'react';
import { Pressable, View } from 'react-native';
import { useSelector } from 'react-redux';
import { Clock, RefreshCw, TriangleAlert, Wifi, WifiOff } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';

import { useAuth, useTheme } from '@/app/providers';
import { selectPendingCount, selectSyncStatus } from '@/app/store';
import { formatSavedAt } from '@/utils';
import { useNetworkStatus } from '../hooks/useNetworkStatus';
import { useSavedCopyTime } from '../hooks/useSavedCopyTime';
import { AnimatedIcon } from './AnimatedIcon';
import { BottomSheetModal } from './BottomSheetModal';
import { Button } from './Button.tsx';
import { Text } from './Text';

type OpenSheet = 'connection' | 'sync' | null;

const ICON_SIZE = 16;
const TARGET_SIZE = 44;
// Real 44pt boxes rather than hitSlop: slop around two icons this close together would overlap.
const TARGET_STYLE = { width: TARGET_SIZE, height: TARGET_SIZE, alignItems: 'center', justifyContent: 'center' } as const;
// Grows to fit the "Saved 14:32" note, which shares the connection icon's tap target.
const SAVED_NOTE_TARGET_STYLE = { ...TARGET_STYLE, width: undefined, minWidth: TARGET_SIZE, flexDirection: 'row' } as const;
// Pulls the last icon back to the header's edge, since its 44pt box is wider than the glyph.
const ICON_INSET = (TARGET_SIZE - ICON_SIZE) / 2;

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
  const savedAt = useSavedCopyTime();
  const savedTime = savedAt === null ? null : formatSavedAt(savedAt);

  const syncing = syncStatus === 'syncing' || retryInFlight;

  const connectionState = t(isOnline ? 'errors.connectionOnline' : 'errors.connectionOffline');
  const savedNote = savedTime === null ? null : t('errors.savedCopyShort', { time: savedTime });
  const connectionLabel = savedNote === null ? connectionState : `${connectionState}, ${savedNote}`;
  const connectionDetail = t(isOnline ? 'errors.connectionOnlineDetail' : 'errors.connectionOfflineDetail');

  const syncLabel = t(
    syncing
      ? 'errors.syncStatusSyncing'
      : syncStatus === 'failed'
        ? 'errors.syncStatusFailed'
        : syncStatus === 'pending'
          ? 'errors.syncStatusPending'
          : 'errors.syncStatusSynced',
  );
  const syncDetail = t(
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
    <View className="flex-row items-center" style={{ marginRight: -ICON_INSET }} testID={testID}>
      <Pressable
        testID={`${testID}-connection`}
        accessibilityRole="button"
        accessibilityLabel={connectionLabel}
        onPress={() => setOpenSheet('connection')}
        style={savedNote === null ? TARGET_STYLE : SAVED_NOTE_TARGET_STYLE}
      >
        {savedNote === null ? null : (
          <Text variant="caption" tone="muted" testID={`${testID}-saved-at`} style={{ marginRight: theme.spacing.xs }}>
            {savedNote}
          </Text>
        )}
        {isOnline ? (
          <Wifi size={ICON_SIZE} color={theme.colors.textMuted} />
        ) : (
          <WifiOff size={ICON_SIZE} color={theme.colors.warning} />
        )}
      </Pressable>

      <Pressable
        testID={`${testID}-sync`}
        accessibilityRole="button"
        accessibilityLabel={syncLabel}
        onPress={() => setOpenSheet('sync')}
        style={TARGET_STYLE}
      >
        {syncing ? (
          <AnimatedIcon icon={RefreshCw} size={ICON_SIZE} color={syncIconColor} animation="spin" />
        ) : syncStatus === 'failed' ? (
          <TriangleAlert size={ICON_SIZE} color={syncIconColor} />
        ) : syncStatus === 'pending' ? (
          <Clock size={ICON_SIZE} color={syncIconColor} />
        ) : (
          <RefreshCw size={ICON_SIZE} color={syncIconColor} />
        )}
      </Pressable>

      <BottomSheetModal
        visible={openSheet === 'connection'}
        onClose={() => setOpenSheet(null)}
        title={connectionState}
        testID={`${testID}-connection-sheet`}
      >
        <Text variant="body" tone="muted" style={{ marginBottom: theme.spacing.md }}>
          {connectionDetail}
        </Text>
        {savedTime === null ? null : (
          <Text variant="body" tone="muted" style={{ marginBottom: theme.spacing.md }}>
            {t('errors.savedCopyDetail', { time: savedTime })}
          </Text>
        )}
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
