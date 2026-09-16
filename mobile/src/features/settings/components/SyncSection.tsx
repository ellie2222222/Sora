import { Check, Clock, RefreshCw, TriangleAlert, Wifi, WifiOff } from 'lucide-react-native';
import { useState } from 'react';
import { View } from 'react-native';
import { useSelector } from 'react-redux';
import { useTranslation } from 'react-i18next';
import { AnimatedIcon, Button, Text } from '@/components';
import { useAuth, useTheme } from '@/app/providers';
import { useNetworkStatus } from '../../../hooks/useNetworkStatus';
import { selectPendingCount, selectSyncStatus } from '@/app/store';
import { CollapsibleSection, SettingsDivider } from './CollapsibleSection';

export function SyncSection({
  isOpen,
  onToggle,
}: {
  isOpen: boolean;
  onToggle: () => void;
}) {
  const theme = useTheme();
  const { t } = useTranslation();
  const { isOnline, isSyncing: retryInFlight, retrySync } = useNetworkStatus();
  const { isGuest } = useAuth();
  const syncStatus = useSelector(selectSyncStatus);
  const pendingCount = useSelector(selectPendingCount);

  const [manualSyncing, setManualSyncing] = useState(false);
  const syncing = syncStatus === 'syncing' || retryInFlight || manualSyncing;

  const handleManualSync = async () => {
    if (syncing) return;
    setManualSyncing(true);
    try {
      await retrySync();
    } finally {
      setManualSyncing(false);
    }
  };

  const syncIconColor = syncing
    ? theme.colors.primary
    : syncStatus === 'failed'
      ? theme.colors.danger
      : syncStatus === 'pending'
        ? theme.colors.textFaint
        : theme.colors.success;

  // Guest mode never has a backend session to sync to — the offline queue
  // stays permanently empty (guest writes bypass it entirely), so
  // `syncStatus`/`isOnline` alone would otherwise read as "connected, synced
  // to the cloud" purely from device network reachability.
  const syncSubtitle = isGuest
    ? t('guest.settings.guestSubtitle')
    : syncing
      ? t('errors.syncStatusSyncing')
      : syncStatus === 'failed'
        ? t('errors.syncStatusFailed')
        : pendingCount > 0
          ? t('errors.syncDetailPending', { count: pendingCount })
          : isOnline
            ? t('errors.syncStatusSynced')
            : t('errors.connectionOffline');

  const connectionTitle = isGuest ? t('guest.settings.guestTitle') : t(isOnline ? 'errors.connectionOnline' : 'errors.connectionOffline');
  const connectionDetail = isGuest
    ? t('guest.settings.guestSubtitle')
    : t(isOnline ? 'errors.connectionOnlineDetail' : 'errors.connectionOfflineDetail');

  const syncTitle = isGuest
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

  return (
    <CollapsibleSection
      testID="settings-nav-sync"
      icon={<RefreshCw size={20} color={theme.colors.primary} />}
      title={t('settings.sync', 'Sync & Storage')}
      subtitle={syncSubtitle}
      isOpen={isOpen}
      onToggle={onToggle}
    >
      <View className="flex-row items-start gap-md py-xs">
        <View className="mt-xxs">
          {isOnline ? (
            <Wifi size={18} color={theme.colors.success} />
          ) : (
            <WifiOff size={18} color={theme.colors.warning} />
          )}
        </View>
        <View className="flex-1 gap-xxs">
          <Text weight="semibold" style={{ fontSize: 14 }}>
            {connectionTitle}
          </Text>
          <Text variant="caption" tone="muted" style={{ lineHeight: 18 }}>
            {connectionDetail}
          </Text>
        </View>
      </View>

      <SettingsDivider />

      <View className="flex-row items-start gap-md py-xs">
        <View className="mt-xxs">
          {syncing ? (
            <AnimatedIcon icon={RefreshCw} size={18} color={syncIconColor} animation="spin" />
          ) : syncStatus === 'failed' ? (
            <TriangleAlert size={18} color={syncIconColor} />
          ) : syncStatus === 'pending' ? (
            <Clock size={18} color={syncIconColor} />
          ) : (
            <Check size={18} color={syncIconColor} strokeWidth={2.5} />
          )}
        </View>

        <View className="flex-1 gap-xxs">
          <Text weight="semibold" style={{ fontSize: 14 }}>
            {syncTitle}
          </Text>
          <Text variant="caption" tone="muted" style={{ lineHeight: 18 }}>
            {syncDetail}
          </Text>
        </View>
      </View>

      {!isGuest && isOnline ? (
        <Button
          testID="sync-settings-sync-now"
          label={t('errors.syncNowAction', 'Sync now')}
          variant="secondary"
          size="sm"
          loading={syncing}
          onPress={() => void handleManualSync()}
          fullWidth
        />
      ) : null}
    </CollapsibleSection>
  );
}

