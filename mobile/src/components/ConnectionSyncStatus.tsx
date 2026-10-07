import { useState } from 'react';
import { Pressable, View } from 'react-native';
import { Clock, RefreshCw, TriangleAlert } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';

import { useTheme } from '@/app/providers';
import { formatSavedAt } from '@/utils';
import { useSavedCopyTime, useSyncStatusView } from '@/hooks';
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
  const targetSize = theme.sizes.badge.sm;
  // Real boxes rather than hitSlop: slop around two icons this close together would overlap.
  const targetStyle = { width: targetSize, height: targetSize, alignItems: 'center', justifyContent: 'center' } as const;
  // Grows to fit the "Saved 14:32" note, which shares the connection icon's tap target.
  const savedNoteTargetStyle = { ...targetStyle, width: undefined, minWidth: targetSize, flexDirection: 'row' } as const;
  // Pulls the last icon back to the header's edge, since its box is wider than the glyph.
  const iconInset = (targetSize - theme.iconSize.md) / 2;
  const {
    isOnline,
    connectionState: connectionStatus,
    checkServer,
    isSyncing: retryInFlight,
    retrySync,
    isGuest,
    syncStatus,
    syncing,
    syncIconColor,
    connectionTitle: connectionState,
    connectionDetail,
    ConnectionIcon,
    connectionIconColor,
    syncTitle: syncLabel,
    syncDetail,
  } = useSyncStatusView();
  const [openSheet, setOpenSheet] = useState<OpenSheet>(null);
  const savedAt = useSavedCopyTime();
  const savedTime = savedAt === null ? null : formatSavedAt(savedAt);

  const savedNote = savedTime === null ? null : t('errors.savedCopyShort', { time: savedTime });
  const connectionLabel = savedNote === null ? connectionState : `${connectionState}, ${savedNote}`;

  const canRetry = !isGuest && isOnline && (syncStatus === 'pending' || syncStatus === 'failed');

  return (
    <View className="flex-row items-center" style={{ marginRight: -iconInset }} testID={testID}>
      <Pressable
        testID={`${testID}-connection`}
        accessibilityRole="button"
        accessibilityLabel={connectionLabel}
        onPress={() => {
          setOpenSheet('connection');
          void checkServer();
        }}
        style={savedNote === null ? targetStyle : savedNoteTargetStyle}
      >
        {savedNote === null ? null : (
          <Text variant="caption" tone="muted" testID={`${testID}-saved-at`}>
            {savedNote}
          </Text>
        )}
        {/* Muted when all is well: a green icon in every header would compete with the figures. */}
        <ConnectionIcon
          size={theme.iconSize.md}
          color={connectionStatus === 'connected' ? theme.colors.textMuted : connectionIconColor}
        />
      </Pressable>

      <Pressable
        testID={`${testID}-sync`}
        accessibilityRole="button"
        accessibilityLabel={syncLabel}
        onPress={() => setOpenSheet('sync')}
        style={targetStyle}
      >
        {syncing ? (
          <AnimatedIcon icon={RefreshCw} size={theme.iconSize.md} color={syncIconColor} animation="spin" />
        ) : syncStatus === 'failed' ? (
          <TriangleAlert size={theme.iconSize.md} color={syncIconColor} />
        ) : syncStatus === 'pending' ? (
          <Clock size={theme.iconSize.md} color={syncIconColor} />
        ) : (
          <RefreshCw size={theme.iconSize.md} color={syncIconColor} />
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
            icon={RefreshCw}
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
